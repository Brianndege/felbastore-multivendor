import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, userType } = req.body;

  if (!token || !userType) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    // Find verification token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return res.status(400).json({ error: "Invalid token." });
    }

    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await prisma.emailVerificationToken.delete({
        where: { token },
      });
      return res.status(400).json({ error: "Token expired." });
    }

    // Verify email based on user type
    if (userType === "user" && verificationToken.userId) {
      await prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: new Date() },
      });
    } else if (userType === "vendor" && verificationToken.vendorId) {
      await prisma.vendor.update({
        where: { id: verificationToken.vendorId },
        data: { emailVerified: new Date() },
      });
    } else {
      return res.status(400).json({ error: "Invalid user type or token." });
    }

    // Delete used token
    await prisma.emailVerificationToken.delete({
      where: { token },
    });

    return res.status(200).json({ message: "Email verified successfully." });
  } catch (error) {
    console.error("Email verification error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
