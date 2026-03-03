import type { NextApiRequest, NextApiResponse } from "next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { z } from "zod";
import { consumeEmailVerificationToken } from "@/lib/auth/token-service";
import { markEmailVerified } from "@/lib/auth/account";
import { logAuthAuditEvent } from "@/lib/auth/audit";
import { getClientIpAddress } from "@/lib/auth/security";

const requestSchema = z.object({
  selector: z.string().min(8),
  token: z.string().min(16),
  expires: z.string().min(1),
  signature: z.string().min(16),
  userType: z.enum(["user", "vendor"]),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid or expired verification link." });
  }

  const { selector, token, expires, signature, userType } = parsed.data;
  const ipAddress = getClientIpAddress(req.headers["x-forwarded-for"]);

  try {
    const verificationToken = await consumeEmailVerificationToken({
      selector,
      secret: token,
      expires,
      signature,
    });

    if (!verificationToken) {
      return res.status(400).json({ error: "Invalid or expired verification link." });
    }

    if (userType === "user" && verificationToken.userId) {
      await markEmailVerified("user", verificationToken.userId);
    } else if (userType === "vendor" && verificationToken.vendorId) {
      await markEmailVerified("vendor", verificationToken.vendorId);
    } else {
      return res.status(400).json({ error: "Invalid or expired verification link." });
    }

    await logAuthAuditEvent({
      event: "email_verified",
      status: "success",
      email: verificationToken.email,
      userType,
      ipAddress,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.status(200).json({ message: "Email verified successfully." });
  } catch {
    return res.status(500).json({ error: "Unable to verify email right now." });
  }
}
