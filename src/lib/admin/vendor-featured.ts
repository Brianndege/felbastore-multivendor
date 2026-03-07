import { prisma } from "@/lib/prisma";

let vendorFeaturedSchemaCompatPromise: Promise<void> | null = null;

export function ensureVendorFeaturedSchemaCompatibility() {
  if (vendorFeaturedSchemaCompatPromise) {
    return vendorFeaturedSchemaCompatPromise;
  }

  vendorFeaturedSchemaCompatPromise = (async () => {
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false'
      );
    } catch {
      // Ignore compatibility guard failures and let Prisma surface hard errors if any.
    }
  })();

  return vendorFeaturedSchemaCompatPromise;
}
