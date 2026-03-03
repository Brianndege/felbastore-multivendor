import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { VISIBLE_VENDOR_PRODUCT_WHERE } from "@/lib/products/visibility";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const [activeVendors, productsLive, pendingApprovals] = await Promise.all([
    prisma.vendor.count({ where: { isActive: true, emailVerified: { not: null } } }),
    prisma.product.count({ where: VISIBLE_VENDOR_PRODUCT_WHERE }),
    prisma.product.count({ where: { productType: "vendor", workflowStatus: "PENDING_APPROVAL", isDummy: false } }),
  ]);

  return res.status(200).json({
    activeVendors,
    productsLive,
    pendingApprovals,
  });
}