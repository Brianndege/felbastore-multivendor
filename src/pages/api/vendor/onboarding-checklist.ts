import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getVendorOnboardingChecklist } from "@/lib/vendor/onboarding";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const checklist = await getVendorOnboardingChecklist(session.user.id);
  if (!checklist) {
    return res.status(404).json({ error: "Vendor profile not found" });
  }

  return res.status(200).json(checklist);
}