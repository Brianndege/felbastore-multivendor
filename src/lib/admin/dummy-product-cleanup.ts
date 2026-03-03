import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { rebuildProductSearchIndex } from "@/lib/products/search-index";
import { invalidateProductCaches } from "@/lib/products/cache-invalidation";
import { logger } from "@/lib/logger";

type CleanupInput = {
  adminUserId: string;
  adminEmail: string;
  dryRun: boolean;
};

const DUMMY_TAGS = ["sample", "test", "demo"];
const DUMMY_CREATORS = ["seed_script", "seed", "demo_seed"];

export async function runDummyProductCleanup(input: CleanupInput) {
  const dummyProducts = await prisma.product.findMany({
    where: {
      productType: "vendor",
      OR: [
        { isDummy: true },
        { createdBy: { in: DUMMY_CREATORS } },
        {
          AND: [
            { createdBy: { in: DUMMY_CREATORS } },
            { tags: { hasSome: DUMMY_TAGS } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      images: true,
      vendorId: true,
    },
  });

  const productIds = dummyProducts.map((product) => product.id);

  const nonDeletable = await prisma.orderItem.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true },
  });

  const nonDeletableSet = new Set(nonDeletable.map((item) => item.productId));
  const removableIds = productIds.filter((id) => !nonDeletableSet.has(id));

  const [reviews, variants, inventoryRecords, searchEntries] = await Promise.all([
    prisma.review.findMany({ where: { productId: { in: removableIds } } }),
    prisma.productVariant.findMany({ where: { productId: { in: removableIds } } }),
    prisma.inventoryRecord.findMany({ where: { productId: { in: removableIds } } }),
    prisma.productSearchIndex.findMany({ where: { productId: { in: removableIds } } }),
  ]);

  const criteria = {
    matchedBy: ["isDummy=true", "createdBy in [seed_script,seed,demo_seed]", "createdBy seed + tags include sample/test/demo"],
    skippedDueToOrderReferences: [...nonDeletableSet],
  };

  logger.warn("[dummy-cleanup] run started", {
    dryRun: input.dryRun,
    adminEmail: input.adminEmail,
    matchedCount: productIds.length,
    removableCount: removableIds.length,
    skippedOrderLinkedCount: nonDeletableSet.size,
  });

  const backupPayload = {
    products: dummyProducts.filter((item) => removableIds.includes(item.id)),
    reviews,
    variants,
    inventoryRecords,
    searchEntries,
  };

  const run = await prisma.adminCleanupRun.create({
    data: {
      adminUserId: input.adminUserId,
      adminEmail: input.adminEmail,
      dryRun: input.dryRun,
      criteria: JSON.stringify(criteria),
      removedProductIds: removableIds,
      removedCount: input.dryRun ? 0 : removableIds.length,
      completedAt: new Date(),
    },
  });

  const backupRows = [
    ...backupPayload.products.map((record) => ({ tableName: "Product", recordId: record.id, payload: JSON.stringify(record) })),
    ...reviews.map((record) => ({ tableName: "Review", recordId: record.id, payload: JSON.stringify(record) })),
    ...variants.map((record) => ({ tableName: "ProductVariant", recordId: record.id, payload: JSON.stringify(record) })),
    ...inventoryRecords.map((record) => ({ tableName: "InventoryRecord", recordId: record.id, payload: JSON.stringify(record) })),
    ...searchEntries.map((record) => ({ tableName: "ProductSearchIndex", recordId: record.id, payload: JSON.stringify(record) })),
  ];

  if (backupRows.length > 0) {
    await prisma.adminCleanupBackup.createMany({
      data: backupRows.map((item) => ({
        runId: run.id,
        tableName: item.tableName,
        recordId: item.recordId,
        payload: item.payload,
      })),
    });
  }

  const backupDir = path.join(process.cwd(), "artifacts", "cleanup-backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `dummy-products-${run.id}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ runId: run.id, criteria, backupPayload }, null, 2), "utf8");

  if (!input.dryRun && removableIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { productId: { in: removableIds } } });
      await tx.wishlistItem.deleteMany({ where: { productId: { in: removableIds } } });
      await tx.review.deleteMany({ where: { productId: { in: removableIds } } });
      await tx.productVariant.deleteMany({ where: { productId: { in: removableIds } } });
      await tx.inventoryRecord.deleteMany({ where: { productId: { in: removableIds } } });
      await tx.productSearchIndex.deleteMany({ where: { productId: { in: removableIds } } });
      await tx.product.deleteMany({ where: { id: { in: removableIds } } });
    });

    for (const imagePath of backupPayload.products.flatMap((product) => product.images || [])) {
      if (!imagePath.startsWith("/uploads/")) continue;
      const absolute = path.join(process.cwd(), "public", imagePath.replace(/^\//, ""));
      if (fs.existsSync(absolute)) {
        try {
          fs.unlinkSync(absolute);
        } catch {
        }
      }
    }

    await rebuildProductSearchIndex();
    await invalidateProductCaches({ reason: "dummy_cleanup", runId: run.id, dryRun: false });
  }

  if (input.dryRun) {
    await invalidateProductCaches({ reason: "dummy_cleanup_dry_run", runId: run.id, dryRun: true });
  }

  logger.warn("[dummy-cleanup] run completed", {
    runId: run.id,
    dryRun: input.dryRun,
    removableCount: removableIds.length,
    backupPath,
  });

  return {
    runId: run.id,
    dryRun: input.dryRun,
    matchedCount: productIds.length,
    removableCount: removableIds.length,
    skippedOrderLinkedCount: nonDeletableSet.size,
    removableIds,
    backupPath,
  };
}