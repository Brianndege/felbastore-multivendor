import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import type { NextApiRequest, NextApiResponse } from "next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { normalizeCategoryName } from "@/lib/categories";
import { getProductEditModerationState } from "@/lib/product-workflow";
import { logVendorProductActivity } from "@/lib/product-activity";
import { normalizeVendorWorkflowStatus, validateVendorProductInput } from "@/lib/products/validation";
import { getVendorOnboardingChecklist } from "@/lib/vendor/onboarding";

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
    const requestedWorkflowStatus = normalizeVendorWorkflowStatus(body?.workflowStatus);
    const normalizedCategory = typeof body?.category === "string" ? normalizeCategoryName(body.category) : product.category;
    const normalizedPrice = typeof body?.price === "number" ? body.price : Number(body?.price ?? product.price);
    const incomingImages = Array.isArray(body?.images) ? body.images.filter((item: unknown) => typeof item === "string" && item.trim()) : product.images;

    const validation = validateVendorProductInput({
      name: typeof body?.name === "string" ? body.name : product.name,
      description: typeof body?.description === "string" ? body.description : product.description,
      category: normalizedCategory,
      price: normalizedPrice,
      imageCount: incomingImages.length,
      workflowStatus: requestedWorkflowStatus,
    });

    if (!validation.valid) {
      return res.status(400).json({ message: "Product validation failed", errors: validation.errors });
    }

    const publishNow = requestedWorkflowStatus === "PENDING_APPROVAL";
    if (publishNow) {
      const onboarding = await getVendorOnboardingChecklist(vendorId);
      if (!onboarding?.isReadyForPublishing) {
        return res.status(400).json({
          message: "Vendor onboarding checklist is incomplete. Complete onboarding before publishing.",
          checklist: onboarding,
        });
      }
    }
    const workflowStatus = publishNow
      ? moderationState.isApproved
        ? "APPROVED"
        : "PENDING_APPROVAL"
      : "DRAFT";

    const normalizedBody = {
      ...body,
      category: normalizedCategory,
      price: normalizedPrice,
      currency: typeof body?.currency === "string" && body.currency.trim() ? body.currency : "KES",
      images: incomingImages,
      status: publishNow ? moderationState.status : "inactive",
      isApproved: publishNow ? moderationState.isApproved : false,
      workflowStatus,
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
