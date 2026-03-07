"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { logAuthAuditEvent } from "@/lib/auth/audit";
import { ensureVendorFeaturedSchemaCompatibility } from "@/lib/admin/vendor-featured";

export async function updateVendorFeaturedAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") || undefined;
  const ipAddress = (headerStore.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";

  if (!session?.user || session.user.role !== "admin") {
    await logAuthAuditEvent({
      event: "admin_vendor_feature_toggle",
      status: "blocked",
      userType: "admin",
      email: session?.user?.email || undefined,
      ipAddress,
      userAgent,
      metadata: { reason: "unauthorized" },
    });
    throw new Error("Unauthorized");
  }

  const vendorId = String(formData.get("vendorId") || "").trim();
  const featuredInput = String(formData.get("featured") || "").trim().toLowerCase();
  const nextFeatured = featuredInput === "true";

  if (!vendorId) {
    throw new Error("Vendor id is required");
  }

  await ensureVendorFeaturedSchemaCompatibility();

  try {
    await prisma.vendor.update({
      where: { id: vendorId },
      data: { featured: nextFeatured },
      select: { id: true },
    });

    await logAuthAuditEvent({
      event: "admin_vendor_feature_toggle",
      status: "success",
      userType: "admin",
      email: session.user.email || undefined,
      ipAddress,
      userAgent,
      metadata: {
        vendorId,
        featured: nextFeatured,
      },
    });
  } catch (error) {
    await logAuthAuditEvent({
      event: "admin_vendor_feature_toggle",
      status: "failure",
      userType: "admin",
      email: session.user.email || undefined,
      ipAddress,
      userAgent,
      metadata: {
        vendorId,
        featured: nextFeatured,
        reason: error instanceof Error ? error.message : "unknown_error",
      },
    });
    throw error;
  }

  revalidatePath("/admin/vendors");
}
