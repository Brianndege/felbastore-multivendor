import { prisma } from "@/lib/prisma";

type ProductActivityAction =
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "product_approved"
  | "product_rejected";

export async function logVendorProductActivity(params: {
  vendorId: string;
  productId: string;
  action: ProductActivityAction;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    eventType: params.action,
    productId: params.productId,
    ...params.metadata,
    timestamp: new Date().toISOString(),
  };

  await prisma.vendorAnalytics.create({
    data: {
      vendorId: params.vendorId,
      data: JSON.stringify(payload),
    },
  });
}

export async function logAdminProductModerationActivity(params: {
  adminId: string;
  action: "product_approved" | "product_rejected";
  productId: string;
  vendorId: string;
  reason?: string;
}) {
  const payload = {
    eventType: params.action,
    productId: params.productId,
    vendorId: params.vendorId,
    reason: params.reason || null,
    timestamp: new Date().toISOString(),
  };

  await prisma.userAnalytics.create({
    data: {
      userId: params.adminId,
      data: JSON.stringify(payload),
    },
  });
}
