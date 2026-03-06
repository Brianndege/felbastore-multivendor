import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/auth/security";

export const ADMIN_ACCESS_KEY_TTL_HOURS = Number(process.env.ADMIN_ACCESS_KEY_TTL_HOURS || "24");
export const ADMIN_PASSWORD_TTL_MINUTES = Number(process.env.ADMIN_PASSWORD_TTL_MINUTES || "30");
export const ADMIN_LOGIN_BUNDLE_TTL_MINUTES = Number(process.env.ADMIN_LOGIN_BUNDLE_TTL_MINUTES || process.env.ADMIN_PASSWORD_TTL_MINUTES || "30");
const ADMIN_PASSWORD_BCRYPT_ROUNDS = Number(process.env.ADMIN_PASSWORD_BCRYPT_ROUNDS || "12");

export type AdminAccessKeyRecord = {
  id: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
};

export type AdminLoginLogRecord = {
  id: string;
  email: string;
  ip: string | null;
  success: boolean;
  event: string;
  createdAt: Date;
};

export type AdminCredentialFailureReason =
  | "access_key_invalid"
  | "access_key_expired"
  | "access_key_used"
  | "password_invalid"
  | "password_expired"
  | "password_used"
  | "credentials_already_used";

type AdminAccessKeyCandidate = {
  id: string;
  expiresAt: Date;
  used: boolean;
  bundleId: string | null;
};

type AdminPasswordCandidate = {
  id: string;
  hashedPassword: string;
  expiresAt: Date;
  used: boolean;
  bundleId: string | null;
};

export type ValidateAndConsumeAdminLoginResult =
  | {
      ok: true;
      access: { id: string; expiresAt: Date; bundleId: string | null };
      password: { id: string; expiresAt: Date; bundleId: string | null };
    }
  | {
      ok: false;
      reason: AdminCredentialFailureReason;
      accessKeyState: "not_found" | "expired" | "used" | "valid";
      passwordState: "unknown" | "not_found" | "expired" | "used" | "valid";
    };

export async function ensureAdminSecuritySchemaCompatibility() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminAccessKey" (
      "id" TEXT PRIMARY KEY,
      "hashedKey" TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "used" BOOLEAN NOT NULL DEFAULT false,
      "usedAt" TIMESTAMP(3),
      "generatedBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminPassword" (
      "id" TEXT PRIMARY KEY,
      "hashedPassword" TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "used" BOOLEAN NOT NULL DEFAULT false,
      "usedAt" TIMESTAMP(3),
      "generatedBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminLoginLog" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL,
      "ip" TEXT,
      "success" BOOLEAN NOT NULL,
      "event" TEXT NOT NULL DEFAULT 'login_attempt',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AdminAccessKey_expiresAt_used_idx" ON "AdminAccessKey"("expiresAt", "used")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AdminPassword_expiresAt_used_idx" ON "AdminPassword"("expiresAt", "used")');
  await prisma.$executeRawUnsafe('ALTER TABLE "AdminAccessKey" ADD COLUMN IF NOT EXISTS "bundleId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "AdminPassword" ADD COLUMN IF NOT EXISTS "bundleId" TEXT');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AdminAccessKey_bundleId_idx" ON "AdminAccessKey"("bundleId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AdminPassword_bundleId_idx" ON "AdminPassword"("bundleId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AdminLoginLog_email_createdAt_idx" ON "AdminLoginLog"("email", "createdAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AdminLoginLog_event_createdAt_idx" ON "AdminLoginLog"("event", "createdAt")');
}

export function generateAdminAccessKey(length = 48) {
  const targetLength = Math.min(64, Math.max(32, length));
  let value = "";

  while (value.length < targetLength) {
    value += crypto.randomBytes(24).toString("base64url");
  }

  return value.slice(0, targetLength);
}

export function generateAdminPassword(length = 20) {
  const targetLength = Math.max(16, length);
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{}:,.?";
  const all = `${uppercase}${lowercase}${numbers}${symbols}`;

  const pick = (chars: string) => chars[crypto.randomInt(0, chars.length)];
  const seed = [pick(uppercase), pick(lowercase), pick(numbers), pick(symbols)];

  while (seed.length < targetLength) {
    seed.push(pick(all));
  }

  for (let i = seed.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [seed[i], seed[j]] = [seed[j], seed[i]];
  }

  return seed.join("");
}

export function isAllowedAdminGenerator(email?: string | null) {
  const configured = (process.env.ADMIN_DEFAULT_EMAIL || "").trim().toLowerCase();
  if (!configured) {
    return process.env.NODE_ENV !== "production";
  }
  return (email || "").trim().toLowerCase() === configured;
}

export async function createAdminAccessKey(generatedBy: string, ttlHours = ADMIN_ACCESS_KEY_TTL_HOURS) {
  const rawKey = generateAdminAccessKey();
  const hashedKey = hashSecret(rawKey);
  const expiresAt = new Date(Date.now() + Math.max(1, ttlHours) * 60 * 60 * 1000);
  const id = crypto.randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "AdminAccessKey" ("id", "hashedKey", "expiresAt", "used", "generatedBy", "bundleId", "createdAt")
    VALUES (${id}, ${hashedKey}, ${expiresAt}, false, ${generatedBy}, NULL, NOW())
  `;

  return { id, rawKey, expiresAt };
}

export async function createAdminPassword(generatedBy: string, ttlMinutes = ADMIN_PASSWORD_TTL_MINUTES) {
  const rawPassword = generateAdminPassword();
  const hashedPassword = await bcrypt.hash(rawPassword, Math.max(10, ADMIN_PASSWORD_BCRYPT_ROUNDS));
  const expiresAt = new Date(Date.now() + Math.max(1, ttlMinutes) * 60 * 1000);
  const id = crypto.randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "AdminPassword" ("id", "hashedPassword", "expiresAt", "used", "generatedBy", "bundleId", "createdAt")
    VALUES (${id}, ${hashedPassword}, ${expiresAt}, false, ${generatedBy}, NULL, NOW())
  `;

  return { id, rawPassword, expiresAt };
}

export async function createAdminLoginBundle(generatedBy: string, ttlMinutes = ADMIN_LOGIN_BUNDLE_TTL_MINUTES) {
  const rawKey = generateAdminAccessKey();
  const hashedKey = hashSecret(rawKey);
  const rawPassword = generateAdminPassword();
  const hashedPassword = await bcrypt.hash(rawPassword, Math.max(10, ADMIN_PASSWORD_BCRYPT_ROUNDS));
  const expiresAt = new Date(Date.now() + Math.max(1, ttlMinutes) * 60 * 1000);
  const accessKeyId = crypto.randomUUID();
  const passwordId = crypto.randomUUID();
  const bundleId = crypto.randomUUID();

  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO "AdminAccessKey" ("id", "hashedKey", "expiresAt", "used", "generatedBy", "bundleId", "createdAt")
      VALUES (${accessKeyId}, ${hashedKey}, ${expiresAt}, false, ${generatedBy}, ${bundleId}, NOW())
    `,
    prisma.$executeRaw`
      INSERT INTO "AdminPassword" ("id", "hashedPassword", "expiresAt", "used", "generatedBy", "bundleId", "createdAt")
      VALUES (${passwordId}, ${hashedPassword}, ${expiresAt}, false, ${generatedBy}, ${bundleId}, NOW())
    `,
  ]);

  return { accessKeyId, passwordId, bundleId, rawKey, rawPassword, expiresAt };
}

export async function findValidAdminAccessKey(rawKey: string) {
  const hashedKey = hashSecret(rawKey);
  const result = await prisma.$queryRaw<Array<{ id: string; expiresAt: Date; bundleId: string | null }>>`
    SELECT "id", "expiresAt", "bundleId"
    FROM "AdminAccessKey"
    WHERE "hashedKey" = ${hashedKey} AND "used" = false AND "expiresAt" > NOW()
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;

  return result[0] || null;
}

async function invalidateExpiredAccessKeyById(id: string) {
  await prisma.$executeRaw`
    UPDATE "AdminAccessKey"
    SET "used" = true, "usedAt" = NOW()
    WHERE "id" = ${id} AND "used" = false AND "expiresAt" <= NOW()
  `;
}

async function invalidateExpiredPasswordById(id: string) {
  await prisma.$executeRaw`
    UPDATE "AdminPassword"
    SET "used" = true, "usedAt" = NOW()
    WHERE "id" = ${id} AND "used" = false AND "expiresAt" <= NOW()
  `;
}

async function findAdminAccessKeyCandidate(rawKey: string): Promise<AdminAccessKeyCandidate | null> {
  const hashedKey = hashSecret(rawKey);
  const result = await prisma.$queryRaw<Array<AdminAccessKeyCandidate>>`
    SELECT "id", "expiresAt", "used", "bundleId"
    FROM "AdminAccessKey"
    WHERE "hashedKey" = ${hashedKey}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;

  return result[0] || null;
}

async function findAdminPasswordCandidate(rawPassword: string, bundleId: string | null): Promise<AdminPasswordCandidate | null> {
  const candidates = bundleId
    ? await prisma.$queryRaw<Array<AdminPasswordCandidate>>`
      SELECT "id", "hashedPassword", "expiresAt", "used", "bundleId"
      FROM "AdminPassword"
      WHERE "bundleId" = ${bundleId}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `
    : await prisma.$queryRaw<Array<AdminPasswordCandidate>>`
      SELECT "id", "hashedPassword", "expiresAt", "used", "bundleId"
      FROM "AdminPassword"
      WHERE "bundleId" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 100
    `;

  for (const candidate of candidates) {
    const isMatch = await bcrypt.compare(rawPassword, candidate.hashedPassword);
    if (isMatch) {
      return candidate;
    }
  }

  return null;
}

export async function validateAndConsumeAdminLoginCredentials(input: {
  rawAccessKey: string;
  rawPassword: string;
}): Promise<ValidateAndConsumeAdminLoginResult> {
  const accessKey = await findAdminAccessKeyCandidate(input.rawAccessKey);

  if (!accessKey) {
    return {
      ok: false,
      reason: "access_key_invalid",
      accessKeyState: "not_found",
      passwordState: "unknown",
    };
  }

  if (accessKey.used) {
    return {
      ok: false,
      reason: "access_key_used",
      accessKeyState: "used",
      passwordState: "unknown",
    };
  }

  if (accessKey.expiresAt <= new Date()) {
    await invalidateExpiredAccessKeyById(accessKey.id);
    return {
      ok: false,
      reason: "access_key_expired",
      accessKeyState: "expired",
      passwordState: "unknown",
    };
  }

  const password = await findAdminPasswordCandidate(input.rawPassword, accessKey.bundleId || null);
  if (!password) {
    return {
      ok: false,
      reason: "password_invalid",
      accessKeyState: "valid",
      passwordState: "not_found",
    };
  }

  if (password.used) {
    return {
      ok: false,
      reason: "password_used",
      accessKeyState: "valid",
      passwordState: "used",
    };
  }

  if (password.expiresAt <= new Date()) {
    await invalidateExpiredPasswordById(password.id);
    return {
      ok: false,
      reason: "password_expired",
      accessKeyState: "valid",
      passwordState: "expired",
    };
  }

  try {
    const consumed = await prisma.$transaction(async (tx) => {
      const consumedPassword = await tx.$queryRaw<Array<{ id: string; expiresAt: Date; bundleId: string | null }>>`
        UPDATE "AdminPassword"
        SET "used" = true, "usedAt" = NOW()
        WHERE "id" = ${password.id} AND "used" = false AND "expiresAt" > NOW()
        RETURNING "id", "expiresAt", "bundleId"
      `;

      if (!consumedPassword[0]) {
        throw new Error("ADMIN_PASSWORD_ALREADY_CONSUMED");
      }

      const consumedAccess = await tx.$queryRaw<Array<{ id: string; expiresAt: Date; bundleId: string | null }>>`
        UPDATE "AdminAccessKey"
        SET "used" = true, "usedAt" = NOW()
        WHERE "id" = ${accessKey.id} AND "used" = false AND "expiresAt" > NOW()
        RETURNING "id", "expiresAt", "bundleId"
      `;

      if (!consumedAccess[0]) {
        throw new Error("ADMIN_ACCESS_KEY_ALREADY_CONSUMED");
      }

      return {
        access: consumedAccess[0],
        password: consumedPassword[0],
      };
    });

    return {
      ok: true,
      access: consumed.access,
      password: consumed.password,
    };
  } catch {
    return {
      ok: false,
      reason: "credentials_already_used",
      accessKeyState: "valid",
      passwordState: "valid",
    };
  }
}

export async function consumeAdminAccessKey(rawKey: string) {
  const hashedKey = hashSecret(rawKey);
  const result = await prisma.$queryRaw<Array<{ id: string; expiresAt: Date; bundleId: string | null }>>`
    UPDATE "AdminAccessKey"
    SET "used" = true, "usedAt" = NOW()
    WHERE "hashedKey" = ${hashedKey} AND "used" = false AND "expiresAt" > NOW()
    RETURNING "id", "expiresAt", "bundleId"
  `;

  return result[0] || null;
}

export async function consumeAdminPassword(rawPassword: string) {
  const candidates = await prisma.$queryRaw<Array<{ id: string; hashedPassword: string; expiresAt: Date }>>`
    SELECT "id", "hashedPassword", "expiresAt"
    FROM "AdminPassword"
    WHERE "used" = false AND "expiresAt" > NOW()
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;

  for (const candidate of candidates) {
    const isMatch = await bcrypt.compare(rawPassword, candidate.hashedPassword);
    if (!isMatch) {
      continue;
    }

    const result = await prisma.$queryRaw<Array<{ id: string; expiresAt: Date }>>`
      UPDATE "AdminPassword"
      SET "used" = true, "usedAt" = NOW()
      WHERE "id" = ${candidate.id} AND "used" = false AND "expiresAt" > NOW()
      RETURNING "id", "expiresAt"
    `;

    if (result[0]) {
      return result[0];
    }
  }

  return null;
}

export async function consumeAdminPasswordForBundle(rawPassword: string, bundleId: string) {
  const candidates = await prisma.$queryRaw<Array<{ id: string; hashedPassword: string; expiresAt: Date }>>`
    SELECT "id", "hashedPassword", "expiresAt"
    FROM "AdminPassword"
    WHERE "used" = false AND "expiresAt" > NOW() AND "bundleId" = ${bundleId}
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;

  for (const candidate of candidates) {
    const isMatch = await bcrypt.compare(rawPassword, candidate.hashedPassword);
    if (!isMatch) {
      continue;
    }

    const result = await prisma.$queryRaw<Array<{ id: string; expiresAt: Date }>>`
      UPDATE "AdminPassword"
      SET "used" = true, "usedAt" = NOW()
      WHERE "id" = ${candidate.id} AND "used" = false AND "expiresAt" > NOW()
      RETURNING "id", "expiresAt"
    `;

    if (result[0]) {
      return result[0];
    }
  }

  return null;
}

export async function listAdminAccessKeys(limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, limit));
  return prisma.$queryRaw<Array<AdminAccessKeyRecord>>`
    SELECT "id", "expiresAt", "used", "createdAt"
    FROM "AdminAccessKey"
    ORDER BY "createdAt" DESC
    LIMIT ${safeLimit}
  `;
}

export async function revokeAdminAccessKeyById(id: string) {
  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "AdminAccessKey"
    SET "used" = true, "usedAt" = NOW()
    WHERE "id" = ${id} AND "used" = false
    RETURNING "id"
  `;

  return result.length > 0;
}

export async function logAdminSecurityEvent(input: {
  email: string;
  ip?: string | null;
  success: boolean;
  event: "login_attempt" | "login_success" | "login_failure" | "key_generation" | "password_generation" | "key_revoked";
}) {
  await prisma.$executeRaw`
    INSERT INTO "AdminLoginLog" ("id", "email", "ip", "success", "event", "createdAt")
    VALUES (${crypto.randomUUID()}, ${input.email}, ${input.ip || null}, ${input.success}, ${input.event}, NOW())
  `;
}

export async function getRecentAdminLoginLogs(limit = 30) {
  const safeLimit = Math.max(1, Math.min(200, limit));
  return prisma.$queryRaw<Array<AdminLoginLogRecord>>`
    SELECT "id", "email", "ip", "success", "event", "createdAt"
    FROM "AdminLoginLog"
    ORDER BY "createdAt" DESC
    LIMIT ${safeLimit}
  `;
}
