import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { enforceCsrfOrigin } from "@/lib/csrf";
import {
  ensureAdminSecuritySchemaCompatibility,
  listAdminAccessKeys,
  logAdminSecurityEvent,
  revokeAdminAccessKeyById,
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setNoStoreHeaders(res);

  await ensureAdminSecuritySchemaCompatibility();

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const keys = await listAdminAccessKeys(50);
    return res.status(200).json({ keys });
  }

  if (req.method === "DELETE") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }

    const { keyId } = req.body || {};
    if (!keyId || typeof keyId !== "string") {
      return res.status(400).json({ error: "keyId is required" });
    }

    const revoked = await revokeAdminAccessKeyById(keyId);
    await logAdminSecurityEvent({
      email: (session.user.email || "").trim().toLowerCase(),
      ip: getClientIp(req),
      success: revoked,
      event: "key_revoked",
    });

    return res.status(200).json({ revoked });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
