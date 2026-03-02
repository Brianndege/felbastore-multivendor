import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = String(req.query.id || "");
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  if (!id) {
    return res.status(400).json({ error: "Missing id" });
  }

  if (!reason) {
    return res.status(400).json({ error: "Rejection reason is required" });
  }

  const updated = await prisma.vendorPaymentMethod.update({
    where: { id },
    data: {
      approvalStatus: "rejected",
      isActive: false,
      approvedByUserId: session.user.id,
      approvedAt: new Date(),
      rejectionReason: reason,
    },
  });

  return res.status(200).json({ message: "Payment method rejected", method: updated });
}
