import type { NextApiRequest, NextApiResponse } from "next";
import { applyAuthRateLimit } from "@/lib/auth/rate-limit";
import { hashIdentifier } from "@/lib/auth/security";
import {
  createAdminPassword,
  ensureAdminSecuritySchemaCompatibility,
  isAllowedAdminGenerator,
  logAdminSecurityEvent,
} from "@/lib/admin/security-auth";

function setNoStoreHeaders(res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
}

function getClientIp(req: NextApiRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return first?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function queryValue(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] || "" : value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setNoStoreHeaders(res);

  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  await ensureAdminSecuritySchemaCompatibility();

  const configuredAdminEmail = (process.env.ADMIN_DEFAULT_EMAIL || "").trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && !configuredAdminEmail) {
    return res.status(500).send("ADMIN_DEFAULT_EMAIL must be configured in production");
  }

  const providedKey = queryValue(req.query.k).trim();
  const providedEmail = queryValue(req.query.email).trim().toLowerCase();
  const configuredBootstrapKey = (process.env.ADMIN_LOGIN_KEY || "").trim();

  const ipAddress = getClientIp(req);
  const limiterKey = `admin-browser-generate-password:${hashIdentifier(ipAddress)}`;
  const limit = applyAuthRateLimit(limiterKey, { windowMs: 15 * 60 * 1000, max: 5 });
  if (!limit.allowed) {
    return res.status(429).send("Too many requests");
  }

  if (!providedKey || !configuredBootstrapKey || providedKey !== configuredBootstrapKey) {
    return res.status(401).send("Unauthorized");
  }

  if (!providedEmail) {
    return res.status(400).send("Missing email query param");
  }

  if (configuredAdminEmail && providedEmail !== configuredAdminEmail) {
    return res.status(403).send("Email not allowed");
  }

  if (!isAllowedAdminGenerator(providedEmail)) {
    await logAdminSecurityEvent({ email: providedEmail, ip: ipAddress, success: false, event: "password_generation" });
    return res.status(403).send("Email not allowed");
  }

  const { rawPassword } = await createAdminPassword(providedEmail);
  await logAdminSecurityEvent({ email: providedEmail, ip: ipAddress, success: true, event: "password_generation" });

  return res.status(200).send(rawPassword);
}
