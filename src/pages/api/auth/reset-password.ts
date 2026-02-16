import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, password, userType } = req.body;

  if (!token || !password || !userType) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  try {
    // Find reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return res.status(400).json({ error: "Invalid token." });
    }

    if (resetToken.expires < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { token },
      });
      return res.status(400).json({ error: "Token expired." });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password based on user type
    if (userType === "user" && resetToken.userId) {
      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      });
    } else if (userType === "vendor" && resetToken.vendorId) {
      await prisma.vendor.update({
        where: { id: resetToken.vendorId },
        data: { password: hashedPassword },
      });
    } else {
      return res.status(400).json({ error: "Invalid user type or token." });
    }

    // Delete used token
    await prisma.passwordResetToken.delete({
      where: { token },
    });

    return res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
