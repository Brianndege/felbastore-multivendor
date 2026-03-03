import { prisma } from "@/lib/prisma";
import { AuthUserType } from "@/lib/auth/account";
import {
  createRandomToken,
  createSignedAuthLink,
  hashSecret,
  timingSafeEqualHex,
  verifySignedAuthLink,
} from "@/lib/auth/security";

type TokenKind = "password_reset" | "email_verification";

type BuildResult = {
  selector: string;
  secret: string;
  expiresAt: Date;
  signedExpires: string;
  signature: string;
};

function createTokenPayload(path: string, ttlMs: number): BuildResult {
  // Selector identifies DB record, secret is only sent to user and stored hashed.
  const selector = createRandomToken(12);
  const secret = createRandomToken(32);
  const expiresAt = new Date(Date.now() + ttlMs);
  const { expires, signature } = createSignedAuthLink(path, selector, secret, expiresAt);

  return {
    selector,
    secret,
    expiresAt,
    signedExpires: expires,
    signature,
  };
}

export async function createPasswordResetToken(input: {
  email: string;
  userType: AuthUserType;
  accountId: string;
  ttlMs: number;
}) {
  const token = createTokenPayload("/auth/reset-password", input.ttlMs);
  const tokenHash = hashSecret(token.secret);

  await prisma.passwordResetToken.deleteMany({
    where: {
      email: input.email,
    },
  });

  await prisma.passwordResetToken.create({
    data: {
      email: input.email,
      token: token.selector,
      tokenHash,
      expires: token.expiresAt,
      usedAt: null,
      userId: input.userType === "user" ? input.accountId : null,
      vendorId: input.userType === "vendor" ? input.accountId : null,
    },
  });

  return token;
}

export async function createEmailVerificationToken(input: {
  email: string;
  userType: AuthUserType;
  accountId: string;
  ttlMs: number;
}) {
  const token = createTokenPayload("/auth/verify-email", input.ttlMs);
  const tokenHash = hashSecret(token.secret);

  await prisma.emailVerificationToken.deleteMany({
    where: {
      email: input.email,
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      email: input.email,
      token: token.selector,
      tokenHash,
      expires: token.expiresAt,
      usedAt: null,
      userId: input.userType === "user" ? input.accountId : null,
      vendorId: input.userType === "vendor" ? input.accountId : null,
    },
  });

  return token;
}

export async function consumePasswordResetToken(input: {
  selector: string;
  secret: string;
  expires: string;
  signature: string;
}) {
  const tokenRow = await prisma.passwordResetToken.findUnique({
    where: { token: input.selector },
  });

  if (!tokenRow || tokenRow.usedAt || tokenRow.expires < new Date()) {
    return null;
  }

  // Signed link binds token material to route and expiry, preventing tampering.
  const validSignature = verifySignedAuthLink("/auth/reset-password", input.selector, input.secret, input.expires, input.signature);
  if (!validSignature) {
    return null;
  }

  const incomingHash = hashSecret(input.secret);
  if (!timingSafeEqualHex(incomingHash, tokenRow.tokenHash || "")) {
    return null;
  }

  await prisma.passwordResetToken.update({
    where: { token: input.selector },
    data: { usedAt: new Date() },
  });

  return tokenRow;
}

export async function consumeEmailVerificationToken(input: {
  selector: string;
  secret: string;
  expires: string;
  signature: string;
}) {
  const tokenRow = await prisma.emailVerificationToken.findUnique({
    where: { token: input.selector },
  });

  if (!tokenRow || tokenRow.usedAt || tokenRow.expires < new Date()) {
    return null;
  }

  const validSignature = verifySignedAuthLink("/auth/verify-email", input.selector, input.secret, input.expires, input.signature);
  if (!validSignature) {
    return null;
  }

  const incomingHash = hashSecret(input.secret);
  if (!timingSafeEqualHex(incomingHash, tokenRow.tokenHash || "")) {
    return null;
  }

  await prisma.emailVerificationToken.update({
    where: { token: input.selector },
    data: { usedAt: new Date() },
  });

  return tokenRow;
}