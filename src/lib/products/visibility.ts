import type { Prisma } from "@prisma/client";

export const VISIBLE_VENDOR_PRODUCT_WHERE: Prisma.ProductWhereInput = {
  productType: "vendor",
  isApproved: true,
  status: "active",
  workflowStatus: "APPROVED",
  isDummy: false,
  OR: [{ createdBy: null }, { createdBy: { notIn: ["seed_script", "seed", "demo_seed"] } }],
};

export function withVisibleVendorProductFilters(where?: Prisma.ProductWhereInput): Prisma.ProductWhereInput {
  if (!where) {
    return { ...VISIBLE_VENDOR_PRODUCT_WHERE };
  }

  return {
    AND: [VISIBLE_VENDOR_PRODUCT_WHERE, where],
  };
}
