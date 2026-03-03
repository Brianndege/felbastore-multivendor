import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { sendVerificationEmail } from "@/lib/email";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { findAccountByEmail } from "@/lib/auth/account";
import { createEmailVerificationToken } from "@/lib/auth/token-service";
import { EMAIL_VERIFICATION_TTL_MS, GENERIC_ACCOUNT_MESSAGE, VERIFY_RESEND_RATE_LIMIT } from "@/lib/auth/constants";
import { applyAuthRateLimit } from "@/lib/auth/rate-limit";
import { getClientIpAddress, hashIdentifier } from "@/lib/auth/security";
import { verifyCaptchaToken } from "@/lib/auth/captcha";
import { logAuthAuditEvent } from "@/lib/auth/audit";

const requestSchema = z.object({
  email: z.string().email(),
  userType: z.enum(["user", "vendor"]),
  captchaToken: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(200).json({ message: GENERIC_ACCOUNT_MESSAGE });
  }

  const { email, userType, captchaToken } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const ipAddress = getClientIpAddress(req.headers["x-forwarded-for"]);
  const rateKey = `verification-resend:${ipAddress}:${hashIdentifier(normalizedEmail)}`;
  const limit = applyAuthRateLimit(rateKey, VERIFY_RESEND_RATE_LIMIT);

  if (!limit.allowed) {
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

    if (account && !account.emailVerified) {
      const verificationToken = await createEmailVerificationToken({
        email: normalizedEmail,
        userType,
        accountId: account.id,
        ttlMs: EMAIL_VERIFICATION_TTL_MS,
      });

      await sendVerificationEmail(
        normalizedEmail,
        {
          selector: verificationToken.selector,
          secret: verificationToken.secret,
          expires: verificationToken.signedExpires,
          signature: verificationToken.signature,
        },
        userType
      );
    }

    await logAuthAuditEvent({
      event: "verification_email_requested",
      status: "success",
      email: normalizedEmail,
      userType,
      ipAddress,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.status(200).json({ message: GENERIC_ACCOUNT_MESSAGE });
  } catch {
    return res.status(200).json({ message: GENERIC_ACCOUNT_MESSAGE });
  }
}
