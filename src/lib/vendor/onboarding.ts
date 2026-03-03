import { prisma } from "@/lib/prisma";

export async function getVendorOnboardingChecklist(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      emailVerified: true,
      storeName: true,
      description: true,
      phone: true,
      address: true,
      city: true,
      country: true,
      taxId: true,
      website: true,
    },
  });

  if (!vendor) {
    return null;
  }

  const paymentMethodCount = await prisma.vendorPaymentMethod.count({
    where: {
      vendorId,
      isActive: true,
      approvalStatus: "approved",
    },
  });

  const checks = {
    emailVerified: Boolean(vendor.emailVerified),
    storeProfileCompleted: Boolean(vendor.storeName && vendor.description && vendor.phone),
    paymentDetailsAdded: paymentMethodCount > 0,
    storeSettingsConfigured: Boolean(vendor.address && vendor.city && vendor.country && (vendor.taxId || vendor.website)),
  };

  const completedCount = Object.values(checks).filter(Boolean).length;
  const totalCount = Object.keys(checks).length;

  return {
    checks,
    completedCount,
    totalCount,
    completionPercent: Math.round((completedCount / totalCount) * 100),
    isReadyForPublishing: completedCount === totalCount,
  };
}