import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { findAccountByEmail } from "@/lib/auth/account";
import { createOtpChallenge } from "@/lib/auth/otp-service";
import { sendOtpEmail } from "@/lib/email";
import { applyAuthRateLimit } from "@/lib/auth/rate-limit";
import { verifyCaptchaToken } from "@/lib/auth/captcha";
import { GENERIC_OTP_MESSAGE, OTP_REQUEST_RATE_LIMIT, OTP_TTL_MS } from "@/lib/auth/constants";
import { createRandomToken, getClientIpAddress, hashIdentifier } from "@/lib/auth/security";
import { logAuthAuditEvent } from "@/lib/auth/audit";

const requestSchema = z.object({
  email: z.string().email(),
  userType: z.enum(["user", "vendor"]),
  captchaToken: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(200).json({ message: GENERIC_OTP_MESSAGE, challengeId: createRandomToken(12) });
  }

  const { email, userType, captchaToken } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const ipAddress = getClientIpAddress(req.headers["x-forwarded-for"]);
  const userAgent = req.headers["user-agent"] || "";

  const rateKey = `otp-request:${ipAddress}:${hashIdentifier(normalizedEmail)}`;
  const otpRequestLimit = applyAuthRateLimit(rateKey, OTP_REQUEST_RATE_LIMIT);

  if (!otpRequestLimit.allowed) {
    await logAuthAuditEvent({
      event: "otp_requested",
      status: "blocked",
      email: normalizedEmail,
      userType,
      ipAddress,
      userAgent,
      metadata: { reason: "rate_limited" },
    });
    return res.status(429).json({ message: GENERIC_OTP_MESSAGE, requiresCaptcha: true, challengeId: createRandomToken(12) });
  }

  if (otpRequestLimit.requiresCaptcha) {
    const captchaResult = await verifyCaptchaToken(captchaToken, ipAddress);
    if (!captchaResult.success) {
      return res.status(429).json({ message: GENERIC_OTP_MESSAGE, requiresCaptcha: true, challengeId: createRandomToken(12) });
    }
  }

  try {
    const account = await findAccountByEmail(userType, normalizedEmail);
    let challengeId = createRandomToken(12);

    if (account) {
      const challenge = await createOtpChallenge({
        email: normalizedEmail,
        userType,
        accountId: account.id,
        ttlMs: OTP_TTL_MS,
      });
      challengeId = challenge.challengeId;
      if (challenge.throttled) {
        return res.status(200).json({
          message: GENERIC_OTP_MESSAGE,
          challengeId,
          resendAfterSeconds: challenge.retryAfterSeconds || 60,
        });
      }

      const mailResult = await sendOtpEmail(normalizedEmail, challenge.code);

      if (!mailResult.success) {
        await logAuthAuditEvent({
          event: "otp_delivery",
          status: "failure",
          email: normalizedEmail,
          userType,
          ipAddress,
          userAgent,
          metadata: { reason: "email_send_failed" },
        });
      }
    }

    await logAuthAuditEvent({
      event: "otp_requested",
      status: "success",
      email: normalizedEmail,
      userType,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      message: GENERIC_OTP_MESSAGE,
      challengeId,
      resendAfterSeconds: 60,
    });
  } catch {
    return res.status(200).json({
      message: GENERIC_OTP_MESSAGE,
      challengeId: createRandomToken(12),
      resendAfterSeconds: 60,
    });
  }
}