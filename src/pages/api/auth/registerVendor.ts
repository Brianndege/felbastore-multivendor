import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { enqueueOutboxEvent } from "@/lib/outbox";
import { logger } from "@/lib/logger";
import { DATABASE_CONFIGURATION_ERROR, hasValidDatabaseUrl, mapDatabaseError } from "@/lib/database-guard";
import { validateStrongPassword } from "@/lib/auth/password-policy";
import { createEmailVerificationToken } from "@/lib/auth/token-service";
import { EMAIL_VERIFICATION_TTL_MS } from "@/lib/auth/constants";
import bcrypt from "bcryptjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    logger.info('[registerVendor] Method not allowed:', req.method);
    return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  if (!hasValidDatabaseUrl()) {
    logger.error("[registerVendor] Invalid DATABASE_URL configuration");
    return res.status(503).json({ code: "DATABASE_NOT_CONFIGURED", message: DATABASE_CONFIGURATION_ERROR });
  }

  logger.info('[registerVendor] Vendor registration attempt started');
  const { name, email, password, storeName } = req.body;

  if (!name || !email || !password || !storeName) {
    logger.info('[registerVendor] Missing fields - name:', !!name, 'email:', !!email, 'password:', !!password, 'storeName:', !!storeName);
    return res.status(400).json({
      code: "MISSING_FIELDS",
      message: "Missing required fields. Please provide name, email, password, and store name.",
    });
  }

  const passwordValidation = validateStrongPassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({
      code: "WEAK_PASSWORD",
      message: "Password does not meet security requirements.",
      details: passwordValidation.issues,
    });
  }

  try {
    logger.info('[registerVendor] Checking for existing vendor with email:', email);
    const existing = await prisma.vendor.findUnique({ where: { email } });

    if (existing) {
      logger.info('[registerVendor] Vendor already exists:', email);
      return res.status(409).json({ code: "VENDOR_EMAIL_ALREADY_EXISTS", message: "A vendor account with this email already exists." });
    }

    logger.info('[registerVendor] Hashing password...');
    const hashed = await bcrypt.hash(password, 12);

    logger.info('[registerVendor] Creating new vendor in database...');
    const newVendor = await prisma.vendor.create({
      data: {
        name,
        email,
        password: hashed,
        storeName,
        role: "vendor",
      },
    });

    logger.info('[registerVendor] Vendor created successfully with ID:', newVendor.id);

    const verificationToken = await createEmailVerificationToken({
      email,
      userType: "vendor",
      accountId: newVendor.id,
      ttlMs: EMAIL_VERIFICATION_TTL_MS,
    });

    logger.info('[registerVendor] Sending verification email to:', email);
    await sendVerificationEmail(
      email,
      {
        selector: verificationToken.selector,
        secret: verificationToken.secret,
        expires: verificationToken.signedExpires,
        signature: verificationToken.signature,
      },
      "vendor"
    );

    logger.info('[registerVendor] Vendor registration completed successfully');

    await enqueueOutboxEvent({
      topic: "vendor.registered",
      entityType: "vendor",
      entityId: newVendor.id,
      payload: {
        vendorId: newVendor.id,
        email: newVendor.email,
        storeName: newVendor.storeName,
        createdAt: new Date().toISOString(),
      },
    });

    return res.status(201).json({
      code: "REGISTER_SUCCESS",
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
    logger.error('[registerVendor] Registration error:', err);
    logger.error('[registerVendor] Error details:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      error: err
    });

    // Return a more specific error message
    let errorMessage = "Failed to create vendor account. Please try again.";

    const dbErrorMessage = mapDatabaseError(err);
    if (dbErrorMessage) {
      errorMessage = dbErrorMessage;
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    return res.status(500).json({ code: "VENDOR_REGISTRATION_FAILED", message: errorMessage });
  }
}
