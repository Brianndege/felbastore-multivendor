import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, userType } = req.body;

  if (!email || !userType) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    // Check if user exists
    let user = null;
    if (userType === "user") {
      user = await prisma.user.findUnique({ where: { email } });
    } else if (userType === "vendor") {
      user = await prisma.vendor.findUnique({ where: { email } });
    }

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({ message: "If an account with that email exists, we've sent a password reset link." });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: {
        email,
        OR: [
          { userId: userType === "user" ? user.id : undefined },
          { vendorId: userType === "vendor" ? user.id : undefined },
        ],
      },
    });

    // Save new token to database
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expires,
        userId: userType === "user" ? user.id : null,
        vendorId: userType === "vendor" ? user.id : null,
      },
    });

    // Send reset email
    const emailResult = await sendPasswordResetEmail(email, token, userType);

    if (!emailResult.success) {
      console.error("Failed to send reset email:", emailResult.error);
    }

    return res.status(200).json({ message: "If an account with that email exists, we've sent a password reset link." });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
