import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/email";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { findAccountByEmail } from "@/lib/auth/account";
import { createPasswordResetToken } from "@/lib/auth/token-service";
import { logAuthAuditEvent } from "@/lib/auth/audit";
import { applyAuthRateLimit } from "@/lib/auth/rate-limit";
import { verifyCaptchaToken } from "@/lib/auth/captcha";
import { GENERIC_ACCOUNT_MESSAGE, PASSWORD_RESET_RATE_LIMIT, PASSWORD_RESET_TTL_MS } from "@/lib/auth/constants";
import { getClientIpAddress, hashIdentifier } from "@/lib/auth/security";

const requestSchema = z.object({
  email: z.string().email(),
  userType: z.enum(["user", "vendor"]),
  captchaToken: z.string().optional(),
});

const GENERIC_RESPONSE = { message: "If an account exists, we’ve sent a reset link." };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(200).json(GENERIC_RESPONSE);
  }

  const { email, userType, captchaToken } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const ipAddress = getClientIpAddress(req.headers["x-forwarded-for"]);
  const rateKey = `forgot-password:${ipAddress}:${hashIdentifier(normalizedEmail)}`;
  const limit = applyAuthRateLimit(rateKey, PASSWORD_RESET_RATE_LIMIT);

  if (!limit.allowed) {
    await logAuthAuditEvent({
      event: "password_reset_requested",
      status: "blocked",
      email: normalizedEmail,
      userType,
      ipAddress,
      userAgent: req.headers["user-agent"] || "",
      metadata: { reason: "rate_limited" },
    });

    return res.status(429).json({ message: GENERIC_ACCOUNT_MESSAGE, requiresCaptcha: true });
  }

  if (limit.requiresCaptcha) {
    const captcha = await verifyCaptchaToken(captchaToken, ipAddress);
    if (!captcha.success) {
      return res.status(429).json({ message: GENERIC_ACCOUNT_MESSAGE, requiresCaptcha: true });
    }
  }

  try {
    const account = await findAccountByEmail(userType, normalizedEmail);

    if (account) {
      const resetToken = await createPasswordResetToken({
        email: normalizedEmail,
        userType,
        accountId: account.id,
        ttlMs: PASSWORD_RESET_TTL_MS,
      });

      await sendPasswordResetEmail(
        normalizedEmail,
        {
          selector: resetToken.selector,
          secret: resetToken.secret,
          expires: resetToken.signedExpires,
          signature: resetToken.signature,
        },
        userType
      );
    }

    await logAuthAuditEvent({
      event: "password_reset_requested",
      status: "success",
      email: normalizedEmail,
      userType,
      ipAddress,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.status(200).json(GENERIC_RESPONSE);
  } catch {
    return res.status(200).json(GENERIC_RESPONSE);
  }
}
