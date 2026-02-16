import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
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

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email already verified." });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save token to database
    await prisma.emailVerificationToken.create({
      data: {
        email,
        token,
        expires,
        userId: userType === "user" ? user.id : null,
        vendorId: userType === "vendor" ? user.id : null,
      },
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(email, token, userType);

    if (!emailResult.success) {
      return res.status(500).json({ error: "Failed to send verification email." });
    }

    return res.status(200).json({ message: "Verification email sent successfully." });
  } catch (error) {
    console.error("Send verification error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
