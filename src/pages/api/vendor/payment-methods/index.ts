import type { NextApiRequest, NextApiResponse } from "next";
import type { PaymentMethodKind } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";

const ALLOWED_VENDOR_METHODS: PaymentMethodKind[] = ["CARD", "MPESA", "BANK_TRANSFER", "WALLET"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const vendorId = session.user.id;

  if (req.method === "GET") {
    const methods = await prisma.vendorPaymentMethod.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ methods });
  }

  if (req.method === "POST") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }

    const { methodKind, label, config } = req.body || {};

    if (!methodKind || !ALLOWED_VENDOR_METHODS.includes(methodKind)) {
      return res.status(400).json({ error: "Invalid methodKind" });
    }

    if (!label || typeof label !== "string" || !label.trim()) {
      return res.status(400).json({ error: "Label is required" });
    }

    const created = await prisma.vendorPaymentMethod.create({
      data: {
        vendorId,
        methodKind,
        label: label.trim(),
        config: typeof config === "string" ? config : config ? JSON.stringify(config) : null,
        approvalStatus: "pending_admin",
        isActive: false,
      },
    });

    return res.status(201).json({
      message: "Payment method submitted for admin approval",
      method: created,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
