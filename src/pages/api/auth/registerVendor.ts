import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    console.log('[registerVendor] Method not allowed:', req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log('[registerVendor] Vendor registration attempt started');
  const { name, email, password, storeName } = req.body;

  if (!name || !email || !password || !storeName) {
    console.log('[registerVendor] Missing fields - name:', !!name, 'email:', !!email, 'password:', !!password, 'storeName:', !!storeName);
    return res.status(400).json({ error: "Missing required fields. Please provide name, email, password, and store name." });
  }

  try {
    console.log('[registerVendor] Checking for existing vendor with email:', email);
    const existing = await prisma.vendor.findUnique({ where: { email } });

    if (existing) {
      console.log('[registerVendor] Vendor already exists:', email);
      return res.status(409).json({ error: "A vendor account with this email already exists." });
    }

    console.log('[registerVendor] Hashing password...');
    const hashed = await bcrypt.hash(password, 10);

    console.log('[registerVendor] Creating new vendor in database...');
    const newVendor = await prisma.vendor.create({
      data: {
        name,
        email,
        password: hashed,
        storeName,
        role: "vendor",
      },
    });

    console.log('[registerVendor] Vendor created successfully with ID:', newVendor.id);

    // Generate verification token and send email
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: {
        email,
        token,
        expires,
        vendorId: newVendor.id,
      },
    });

    console.log('[registerVendor] Sending verification email to:', email);
    await sendVerificationEmail(email, token, "vendor");

    console.log('[registerVendor] Vendor registration completed successfully');
    return res.status(201).json({
      vendor: {
        id: newVendor.id,
        name: newVendor.name,
        email: newVendor.email,
        storeName: newVendor.storeName,
        role: newVendor.role
      },
      message: "Vendor account created successfully! Please check your email to verify your account."
    });
  } catch (err) {
    console.error('[registerVendor] Registration error:', err);
    console.error('[registerVendor] Error details:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      error: err
    });

    // Return a more specific error message
    let errorMessage = "Failed to create vendor account. Please try again.";

    if (err instanceof Error) {
      if (err.message.includes('Unique constraint')) {
        errorMessage = "A vendor account with this email already exists.";
      } else if (err.message.includes('connection')) {
        errorMessage = "Database connection error. Please try again later.";
      } else {
        errorMessage = err.message;
      }
    }

    return res.status(500).json({ error: errorMessage });
  }
}
