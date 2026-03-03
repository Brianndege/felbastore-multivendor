import { prisma } from "@/lib/prisma";
import { AuthUserType } from "@/lib/auth/account";
import { createOtpCode, createRandomToken, hashSecret, timingSafeEqualHex } from "@/lib/auth/security";

export async function createOtpChallenge(input: {
  email: string;
  userType: AuthUserType;
  accountId: string;
  ttlMs: number;
}) {
  const existingRecent = await prisma.emailOtpChallenge.findFirst({
    where: {
      email: input.email,
      userType: input.userType,
      usedAt: null,
      createdAt: {
        gte: new Date(Date.now() - 60_000),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingRecent) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existingRecent.createdAt.getTime() + 60_000 - Date.now()) / 1000)
    );

    return {
      challengeId: existingRecent.challengeId,
      code: "",
      expiresAt: existingRecent.expiresAt,
      retryAfterSeconds,
      throttled: true,
    };
  }

  const challengeId = createRandomToken(12);
  const code = createOtpCode();
  const codeHash = hashSecret(code);
  const expiresAt = new Date(Date.now() + input.ttlMs);

  await prisma.emailOtpChallenge.deleteMany({
    where: {
      email: input.email,
      userType: input.userType,
      usedAt: null,
    },
  });

  await prisma.emailOtpChallenge.create({
    data: {
      challengeId,
      email: input.email,
      userType: input.userType,
      codeHash,
      expiresAt,
      maxAttempts: 5,
      attempts: 0,
      userId: input.userType === "user" ? input.accountId : null,
      vendorId: input.userType === "vendor" ? input.accountId : null,
    },
  });

  return {
    challengeId,
    code,
    expiresAt,
    retryAfterSeconds: 60,
    throttled: false,
  };
}

export async function verifyOtpChallenge(input: {
  challengeId: string;
  code: string;
}) {
  const challenge = await prisma.emailOtpChallenge.findUnique({
    where: { challengeId: input.challengeId },
  });

  if (!challenge || challenge.usedAt) {
    return { success: false, reason: "invalid" as const };
  }

  if (challenge.expiresAt < new Date()) {
    return { success: false, reason: "expired" as const };
  }

  if (challenge.lockedUntil && challenge.lockedUntil > new Date()) {
    return { success: false, reason: "locked" as const };
  }

  const incomingHash = hashSecret(input.code);
  const codeMatches = timingSafeEqualHex(incomingHash, challenge.codeHash);

  if (!codeMatches) {
    const nextAttempts = challenge.attempts + 1;
    const shouldLock = nextAttempts >= challenge.maxAttempts;

    await prisma.emailOtpChallenge.update({
      where: { challengeId: input.challengeId },
      data: {
        attempts: nextAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null,
      },
    });

    return {
      success: false,
      reason: shouldLock ? ("locked" as const) : ("invalid" as const),
      attemptsLeft: Math.max(0, challenge.maxAttempts - nextAttempts),
    };
  }

  await prisma.emailOtpChallenge.update({
    where: { challengeId: input.challengeId },
    data: {
      usedAt: new Date(),
    },
  });

  return {
    success: true,
    challenge,
  };
}