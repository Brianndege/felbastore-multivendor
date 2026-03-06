import type { NextApiRequest, NextApiResponse } from "next";
import { applyAuthRateLimit } from "@/lib/auth/rate-limit";
import { hashIdentifier } from "@/lib/auth/security";
import { prisma } from "@/lib/prisma";
import {
  createAdminLoginBundle,
  ensureAdminSecuritySchemaCompatibility,
  isAllowedAdminGenerator,
  logAdminSecurityEvent,
} from "@/lib/admin/security-auth";

function setNoStoreHeaders(res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function getClientIp(req: NextApiRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return first?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function queryValue(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] || "" : value;
}

function getBaseUrl(req: NextApiRequest) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_NEXTAUTH_URL || process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (process.env.NODE_ENV === "production") {
    return "";
  }

  return `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setNoStoreHeaders(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await ensureAdminSecuritySchemaCompatibility();

  const configuredAdminEmail = (process.env.ADMIN_DEFAULT_EMAIL || "").trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && !configuredAdminEmail) {
    return res.status(500).json({ error: "ADMIN_DEFAULT_EMAIL must be configured in production" });
  }

  const providedKey = queryValue(req.query.k).trim();
  const providedEmail = queryValue(req.query.email).trim().toLowerCase();
  const configuredBootstrapKey = (process.env.ADMIN_LOGIN_KEY || "").trim();

  const ipAddress = getClientIp(req);
  const limiterKey = `admin-browser-generate-login-bundle:${hashIdentifier(ipAddress)}`;
  const limit = applyAuthRateLimit(limiterKey, { windowMs: 15 * 60 * 1000, max: 1 });
  if (!limit.allowed) {
    return res.status(429).json({
      error: "Generation is locked for 15 minutes after each bundle.",
      attempts: limit.attempts,
      maxAttempts: limit.max,
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  if (!providedKey || !configuredBootstrapKey || providedKey !== configuredBootstrapKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!providedEmail) {
    return res.status(400).json({ error: "Missing email query param" });
  }

  if (configuredAdminEmail && providedEmail !== configuredAdminEmail) {
    return res.status(403).json({ error: "Email not allowed" });
  }

  if (!isAllowedAdminGenerator(providedEmail)) {
    await logAdminSecurityEvent({ email: providedEmail, ip: ipAddress, success: false, event: "key_generation" });
    await logAdminSecurityEvent({ email: providedEmail, ip: ipAddress, success: false, event: "password_generation" });
    return res.status(403).json({ error: "Email not allowed" });
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: providedEmail },
    select: { id: true, role: true },
  });
  if (!adminUser || adminUser.role !== "admin") {
    return res.status(409).json({ error: "Admin account not ready. Run admin:ensure and retry." });
  }

  const baseUrl = getBaseUrl(req);
  if (!baseUrl) {
    return res.status(500).json({ error: "APP_URL or NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_NEXTAUTH_URL must be configured in production" });
  }

  const { rawKey, rawPassword, expiresAt } = await createAdminLoginBundle(providedEmail);
  const loginUrl = `${baseUrl}/admin/login/${rawKey}?email=${encodeURIComponent(providedEmail)}`;

  await logAdminSecurityEvent({ email: providedEmail, ip: ipAddress, success: true, event: "key_generation" });
  await logAdminSecurityEvent({ email: providedEmail, ip: ipAddress, success: true, event: "password_generation" });

  return res.status(200).json({
    loginUrl,
    password: rawPassword,
    expiresAt: expiresAt.toISOString(),
    attempts: limit.attempts,
    maxAttempts: limit.max,
    retryAfterSeconds: limit.retryAfterSeconds,
  });
}
