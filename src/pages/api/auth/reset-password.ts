import type { NextApiRequest, NextApiResponse } from "next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { consumePasswordResetToken } from "@/lib/auth/token-service";
import { updateAccountPassword } from "@/lib/auth/account";
import { validateStrongPassword } from "@/lib/auth/password-policy";
import { logAuthAuditEvent } from "@/lib/auth/audit";
import { getClientIpAddress } from "@/lib/auth/security";

const requestSchema = z.object({
  selector: z.string().min(8),
  token: z.string().min(16),
  expires: z.string().min(1),
  signature: z.string().min(16),
  password: z.string().min(12),
  userType: z.enum(["user", "vendor"]),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid or expired reset link." });
  }

  const { selector, token, expires, signature, password, userType } = parsed.data;
  const ipAddress = getClientIpAddress(req.headers["x-forwarded-for"]);

  const passwordCheck = validateStrongPassword(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({
      error: "Password does not meet security requirements.",
      details: passwordCheck.issues,
    });
  }

  try {
    const resetToken = await consumePasswordResetToken({
      selector,
      secret: token,
      expires,
      signature,
    });

    if (!resetToken) {
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (userType === "user" && resetToken.userId) {
      await updateAccountPassword("user", resetToken.userId, hashedPassword);
    } else if (userType === "vendor" && resetToken.vendorId) {
      await updateAccountPassword("vendor", resetToken.vendorId, hashedPassword);
    } else {
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }

    await logAuthAuditEvent({
      event: "password_reset_completed",
      status: "success",
      email: resetToken.email,
      userType,
      ipAddress,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.status(200).json({ message: "Password reset successfully." });
  } catch {
    return res.status(500).json({ error: "Unable to reset password right now." });
  }
}
