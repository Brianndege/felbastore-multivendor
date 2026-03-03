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
    logger.info('[registerUser] Method not allowed:', req.method);
    return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  if (!hasValidDatabaseUrl()) {
    logger.error("[registerUser] Invalid DATABASE_URL configuration");
    return res.status(503).json({ code: "DATABASE_NOT_CONFIGURED", message: DATABASE_CONFIGURATION_ERROR });
  }

  logger.info('[registerUser] Registration attempt started');
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    logger.info('[registerUser] Missing fields - name:', !!name, 'email:', !!email, 'password:', !!password);
    return res.status(400).json({
      code: "MISSING_FIELDS",
      message: "Missing required fields. Please provide name, email, and password.",
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
    logger.info('[registerUser] Checking for existing user with email:', email);
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      logger.info('[registerUser] User already exists:', email);
      return res.status(409).json({ code: "EMAIL_ALREADY_EXISTS", message: "An account with this email already exists." });
    }

    logger.info('[registerUser] Hashing password...');
    const hashed = await bcrypt.hash(password, 12);

    logger.info('[registerUser] Creating new user in database...');
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: "user",
      },
    });

    logger.info('[registerUser] User created successfully with ID:', newUser.id);

    const verificationToken = await createEmailVerificationToken({
      email,
      userType: "user",
      accountId: newUser.id,
      ttlMs: EMAIL_VERIFICATION_TTL_MS,
    });

    logger.info('[registerUser] Sending verification email to:', email);
    await sendVerificationEmail(
      email,
      {
        selector: verificationToken.selector,
        secret: verificationToken.secret,
        expires: verificationToken.signedExpires,
        signature: verificationToken.signature,
      },
      "user"
    );

    logger.info('[registerUser] Registration completed successfully');

    await enqueueOutboxEvent({
      topic: "user.registered",
      entityType: "user",
      entityId: newUser.id,
      payload: {
        userId: newUser.id,
        email: newUser.email,
        createdAt: new Date().toISOString(),
      },
    });

    return res.status(201).json({
      code: "REGISTER_SUCCESS",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      },
      message: "Account created successfully! Please check your email to verify your account."
    });
  } catch (err) {
    logger.error('[registerUser] Registration error:', err);
    logger.error('[registerUser] Error details:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      error: err
    });

    // Return a more specific error message
    let errorMessage = "Failed to create account. Please try again.";

    const dbErrorMessage = mapDatabaseError(err);
    if (dbErrorMessage) {
      errorMessage = dbErrorMessage;
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    return res.status(500).json({ code: "REGISTRATION_FAILED", message: errorMessage });
  }
}
