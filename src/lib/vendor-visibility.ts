import { prisma } from "@/lib/prisma";

export type VendorVisibilityRecord = {
  vendorId: string;
  isPublic: boolean;
  reason: string | null;
  updatedAt: Date;
  updatedBy: string | null;
};

type VisibilityPayload = {
  eventType?: string;
  isPublic?: boolean;
  reason?: string;
  updatedBy?: string;
};

function parseVisibilityPayload(raw: string | null): VisibilityPayload | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as VisibilityPayload;
    if (parsed?.eventType !== "vendor_visibility") return null;
    if (typeof parsed.isPublic !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getVendorVisibilityMap(vendorIds: string[]): Promise<Map<string, VendorVisibilityRecord>> {
  const uniqueVendorIds = Array.from(new Set(vendorIds.filter(Boolean)));
  if (uniqueVendorIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.vendorAnalytics.findMany({
    where: {
      vendorId: {
        in: uniqueVendorIds,
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(200, uniqueVendorIds.length * 25),
  });

  const visibilityByVendor = new Map<string, VendorVisibilityRecord>();

  for (const row of rows) {
    if (visibilityByVendor.has(row.vendorId)) {
      continue;
    }

    const payload = parseVisibilityPayload(row.data);
    if (!payload) {
      continue;
    }

    visibilityByVendor.set(row.vendorId, {
      vendorId: row.vendorId,
      isPublic: payload.isPublic as boolean,
      reason: typeof payload.reason === "string" && payload.reason.trim().length > 0 ? payload.reason.trim() : null,
      updatedBy: typeof payload.updatedBy === "string" && payload.updatedBy.trim().length > 0 ? payload.updatedBy.trim() : null,
      updatedAt: row.createdAt,
    });
  }

  return visibilityByVendor;
}

export async function setVendorVisibility(input: {
  vendorId: string;
  isPublic: boolean;
  reason?: string;
  updatedBy?: string;
}): Promise<void> {
  const data = {
    eventType: "vendor_visibility",
    isPublic: input.isPublic,
    reason: input.reason?.trim() || null,
    updatedBy: input.updatedBy || null,
    updatedAt: new Date().toISOString(),
  };

  await prisma.vendorAnalytics.create({
    data: {
      vendorId: input.vendorId,
      data: JSON.stringify(data),
    },
  });
}
