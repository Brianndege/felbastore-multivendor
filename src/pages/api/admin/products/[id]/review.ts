import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { logAdminProductModerationActivity, logVendorProductActivity } from "@/lib/product-activity";

type ReviewAction = "approve" | "reject";

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

  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid product id" });
  }

  const { action, reason } = (req.body || {}) as { action?: ReviewAction; reason?: string };
  if (!action || !["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "Action must be approve or reject" });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          storeName: true,
        },
      },
    },
  });

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data:
      action === "approve"
        ? { isApproved: true, status: "active" }
        : { isApproved: false, status: "inactive" },
  });

  const notificationMessage =
    action === "approve"
      ? `Your product \"${product.name}\" has been approved and is now visible to customers.`
      : `Your product \"${product.name}\" has been rejected.${reason ? ` Reason: ${reason}` : ""}`;

  await prisma.notification.create({
    data: {
      vendorId: product.vendorId,
      type: "product_moderation",
      priority: action === "approve" ? "normal" : "high",
      title: action === "approve" ? "Product Approved" : "Product Rejected",
      message: notificationMessage,
      data: JSON.stringify({
        productId: product.id,
        action,
        reason: reason || null,
        reviewedBy: session.user.id,
      }),
    },
  });

  await logVendorProductActivity({
    vendorId: product.vendorId,
    productId: product.id,
    action: action === "approve" ? "product_approved" : "product_rejected",
    metadata: {
      reason: reason || null,
      reviewedBy: session.user.id,
      reviewedByRole: "admin",
    },
  });

  await logAdminProductModerationActivity({
    adminId: session.user.id,
    action: action === "approve" ? "product_approved" : "product_rejected",
    productId: product.id,
    vendorId: product.vendorId,
    reason,
  });

  return res.status(200).json({
    message: action === "approve" ? "Product approved" : "Product rejected",
    product: updatedProduct,
  });
}
