import type { NextApiRequest, NextApiResponse } from "next";
import { enforceCsrfOrigin } from "@/lib/csrf";

function clearCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const secure = process.env.NODE_ENV === "production";
  const secureSuffix = secure ? "; Secure" : "";

  res.setHeader("Set-Cookie", [
    `${clearCookie("next-auth.session-token")}${secureSuffix}`,
    `${clearCookie("__Secure-next-auth.session-token")}${secureSuffix}`,
    `${clearCookie("admin_access_token")}${secureSuffix}`,
  ]);

  return res.status(200).json({ closed: true });
}
