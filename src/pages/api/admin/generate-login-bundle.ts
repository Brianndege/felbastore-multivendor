import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { applyAuthRateLimit } from "@/lib/auth/rate-limit";
import { hashIdentifier } from "@/lib/auth/security";
import {
  createAdminLoginBundle,
  ensureAdminSecuritySchemaCompatibility,
  isAllowedAdminGenerator,
  logAdminSecurityEvent,
} from "@/lib/admin/security-auth";

function getClientIp(req: NextApiRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return first?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function setNoStoreHeaders(res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function getBaseUrl(req: NextApiRequest) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_NEXTAUTH_URL || process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (process.env.NODE_ENV === "production") {
    return "";
  }

  return `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setNoStoreHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  await ensureAdminSecuritySchemaCompatibility();

  const configuredAdminEmail = (process.env.ADMIN_DEFAULT_EMAIL || "").trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && !configuredAdminEmail) {
    return res.status(500).json({ error: "ADMIN_DEFAULT_EMAIL must be configured in production" });
  }

  const ipAddress = getClientIp(req);
  const limiterKey = `admin-generate-login-bundle:${hashIdentifier(ipAddress)}`;
  const limit = applyAuthRateLimit(limiterKey, { windowMs: 15 * 60 * 1000, max: 1 });
  if (!limit.allowed) {
    return res.status(429).json({
      error: "Generation is locked for 15 minutes after each bundle.",
      attempts: limit.attempts,
      maxAttempts: limit.max,
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const session = await getServerSession(req, res, authOptions);
  const bootstrapEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const bootstrapKey = (req.headers["x-admin-login-key"] || "").toString().trim();
  const configuredBootstrapKey = (process.env.ADMIN_LOGIN_KEY || "").trim();

  const hasSecureSession = Boolean(
    session
    && session.user.role === "admin"
    && session.user.adminSecurityVerified
    && session.user.adminAccessKeyId
  );

  const isBootstrapRequest = Boolean(
    bootstrapEmail
    && (!configuredAdminEmail || bootstrapEmail === configuredAdminEmail)
    && configuredBootstrapKey
    && bootstrapKey
    && bootstrapKey === configuredBootstrapKey
  );

  if (!hasSecureSession && !isBootstrapRequest) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const email = hasSecureSession
    ? (session?.user.email || "").trim().toLowerCase()
    : bootstrapEmail;

  if (!isAllowedAdminGenerator(email)) {
    await logAdminSecurityEvent({ email, ip: ipAddress, success: false, event: "key_generation" });
    await logAdminSecurityEvent({ email, ip: ipAddress, success: false, event: "password_generation" });
    return res.status(403).json({ error: "Only the configured admin email can generate admin login credentials" });
  }

  const baseUrl = getBaseUrl(req);
  if (!baseUrl) {
    return res.status(500).json({ error: "APP_URL or NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_NEXTAUTH_URL must be configured in production" });
  }

  const { rawKey, rawPassword, expiresAt } = await createAdminLoginBundle(email);
  const loginUrl = `${baseUrl}/admin/login/${rawKey}`;

  await logAdminSecurityEvent({ email, ip: ipAddress, success: true, event: "key_generation" });
  await logAdminSecurityEvent({ email, ip: ipAddress, success: true, event: "password_generation" });

  return res.status(200).json({
    loginUrl,
    password: rawPassword,
    expiresAt: expiresAt.toISOString(),
    attempts: limit.attempts,
    maxAttempts: limit.max,
    retryAfterSeconds: limit.retryAfterSeconds,
  });
}
