import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import type { NextApiRequest, NextApiResponse } from "next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { normalizeCategoryName } from "@/lib/categories";
import { getProductEditModerationState } from "@/lib/product-workflow";
import { logVendorProductActivity } from "@/lib/product-activity";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const vendorId = session.user.id;
  const { id } = req.query;

  if (req.method === "GET") {
    const product = await prisma.product.findUnique({ where: { id: String(id) } });
    if (!product || product.vendorId !== vendorId) return res.status(404).json({ message: "Product not found" });
    return res.status(200).json(product);
  }

  if (req.method === "PUT") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }

    const body = req.body;
    const product = await prisma.product.findUnique({ where: { id: String(id) } });
    if (!product || product.vendorId !== vendorId) return res.status(404).json({ message: "Product not found" });

    const moderationState = getProductEditModerationState();

    const normalizedBody = {
      ...body,
      category: typeof body?.category === "string" ? normalizeCategoryName(body.category) : body?.category,
      currency: typeof body?.currency === "string" && body.currency.trim() ? body.currency : "KES",
      status: moderationState.status,
      isApproved: moderationState.isApproved,
    };

    const updated = await prisma.product.update({
      where: { id: String(id) },
      data: normalizedBody,
    });

    await logVendorProductActivity({
      vendorId,
      productId: String(id),
      action: "product_updated",
      metadata: {
        status: updated.status,
        isApproved: updated.isApproved,
      },
    });

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: String(id) } });
    if (!product || product.vendorId !== vendorId) return res.status(404).json({ message: "Product not found" });

    await logVendorProductActivity({
      vendorId,
      productId: String(id),
      action: "product_deleted",
      metadata: {
        name: product.name,
        sku: product.sku,
      },
    });

    await prisma.product.delete({ where: { id: String(id) } });
    return res.status(200).json({ message: "Product deleted" });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
