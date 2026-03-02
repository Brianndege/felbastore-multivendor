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
  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const productId = String(req.query.id || "");
  const vendorId = session.user.id;
  const vendorPaymentMethodIds = Array.isArray(req.body?.vendorPaymentMethodIds)
    ? (req.body.vendorPaymentMethodIds as string[])
    : [];

  if (!productId) {
    return res.status(400).json({ error: "Missing product id" });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, vendorId },
    select: { id: true },
  });

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const approvedMethods = await prisma.vendorPaymentMethod.findMany({
    where: {
      id: { in: vendorPaymentMethodIds },
      vendorId,
      approvalStatus: "approved",
      isActive: true,
    },
    select: { id: true },
  });

  if (approvedMethods.length !== vendorPaymentMethodIds.length) {
    return res.status(400).json({
      error: "One or more payment methods are not approved/active",
    });
  }

  await prisma.$transaction([
    prisma.productPaymentMethod.deleteMany({ where: { productId } }),
    ...(approvedMethods.length
      ? [
          prisma.productPaymentMethod.createMany({
            data: approvedMethods.map((method) => ({
              productId,
              vendorPaymentMethodId: method.id,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  const links = await prisma.productPaymentMethod.findMany({
    where: { productId },
    include: {
      vendorPaymentMethod: true,
    },
  });

  return res.status(200).json({
    message: "Product payment methods updated",
    paymentMethods: links.map((link) => link.vendorPaymentMethod),
  });
}
