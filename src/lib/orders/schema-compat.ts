import { prisma } from "@/lib/prisma";

let orderLifecycleSchemaCompatPromise: Promise<void> | null = null;

export function ensureOrderLifecycleSchemaCompatibility() {
  if (orderLifecycleSchemaCompatPromise) {
    return orderLifecycleSchemaCompatPromise;
  }

  orderLifecycleSchemaCompatPromise = (async () => {
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerId" TEXT'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "vendorId" TEXT'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT \'PENDING\''
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingProvider" TEXT'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3)'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3)'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3)'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3)'
      );

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "OrderLog" (
          "id" TEXT PRIMARY KEY,
          "orderId" TEXT NOT NULL,
          "vendorId" TEXT,
          "actorUserId" TEXT,
          "actorRole" TEXT NOT NULL,
          "fromStatus" TEXT,
          "toStatus" TEXT NOT NULL,
          "note" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
        )
      `);

      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "OrderLog_orderId_createdAt_idx" ON "OrderLog" ("orderId", "createdAt")'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "OrderLog_vendorId_createdAt_idx" ON "OrderLog" ("vendorId", "createdAt")'
      );
    } catch {
      // Keep compatibility guard best-effort and let normal Prisma errors bubble if queries still fail.
    }
  })();

  return orderLifecycleSchemaCompatPromise;
}
