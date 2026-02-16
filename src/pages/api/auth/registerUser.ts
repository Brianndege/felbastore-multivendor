import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    console.log('[registerUser] Method not allowed:', req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log('[registerUser] Registration attempt started');
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    console.log('[registerUser] Missing fields - name:', !!name, 'email:', !!email, 'password:', !!password);
    return res.status(400).json({ error: "Missing required fields. Please provide name, email, and password." });
  }

  try {
    console.log('[registerUser] Checking for existing user with email:', email);
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      console.log('[registerUser] User already exists:', email);
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    console.log('[registerUser] Hashing password...');
    const hashed = await bcrypt.hash(password, 10);

    console.log('[registerUser] Creating new user in database...');
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: "user",
      },
    });

    console.log('[registerUser] User created successfully with ID:', newUser.id);

    // Generate verification token and send email
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: {
        email,
        token,
        expires,
        userId: newUser.id,
      },
    });

    console.log('[registerUser] Sending verification email to:', email);
    await sendVerificationEmail(email, token, "user");

    console.log('[registerUser] Registration completed successfully');
    return res.status(201).json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      },
      message: "Account created successfully! Please check your email to verify your account."
    });
  } catch (err) {
    console.error('[registerUser] Registration error:', err);
    console.error('[registerUser] Error details:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      error: err
    });

    // Return a more specific error message
    let errorMessage = "Failed to create account. Please try again.";

    if (err instanceof Error) {
      if (err.message.includes('Unique constraint')) {
        errorMessage = "An account with this email already exists.";
      } else if (err.message.includes('connection')) {
        errorMessage = "Database connection error. Please try again later.";
      } else {
        errorMessage = err.message;
      }
    }

    return res.status(500).json({ error: errorMessage });
  }
}
