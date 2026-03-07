/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const orphanedOrders = await prisma.$queryRawUnsafe(`
    SELECT
      o."id",
      o."orderNumber",
      o."userId",
      o."customerId",
      o."vendorId"
    FROM "Order" o
    LEFT JOIN "User" u ON u."id" = o."userId"
    LEFT JOIN "User" c ON c."id" = o."customerId"
    LEFT JOIN "Vendor" v ON v."id" = o."vendorId"
    WHERE
      u."id" IS NULL
      OR (o."customerId" IS NOT NULL AND c."id" IS NULL)
      OR (o."vendorId" IS NOT NULL AND v."id" IS NULL)
    ORDER BY o."createdAt" DESC
    LIMIT 500
  `);

  const orphanedOrderItems = await prisma.$queryRawUnsafe(`
    SELECT
      oi."id",
      oi."orderId",
      oi."productId",
      oi."vendorId"
    FROM "OrderItem" oi
    LEFT JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "Product" p ON p."id" = oi."productId"
    LEFT JOIN "Vendor" v ON v."id" = oi."vendorId"
    WHERE o."id" IS NULL OR p."id" IS NULL OR v."id" IS NULL
    LIMIT 500
  `);

  const orphanedFulfillments = await prisma.$queryRawUnsafe(`
    SELECT
      f."id",
      f."orderId",
      f."vendorId"
    FROM "OrderVendorFulfillment" f
    LEFT JOIN "Order" o ON o."id" = f."orderId"
    LEFT JOIN "Vendor" v ON v."id" = f."vendorId"
    WHERE o."id" IS NULL OR v."id" IS NULL
    LIMIT 500
  `);

  const ordersCount = Array.isArray(orphanedOrders) ? orphanedOrders.length : 0;
  const itemsCount = Array.isArray(orphanedOrderItems) ? orphanedOrderItems.length : 0;
  const fulfillmentsCount = Array.isArray(orphanedFulfillments) ? orphanedFulfillments.length : 0;

  console.log("Orphan Audit Summary");
  console.log(JSON.stringify({
    orphanedOrders: ordersCount,
    orphanedOrderItems: itemsCount,
    orphanedFulfillments: fulfillmentsCount,
  }, null, 2));

  if (ordersCount > 0) {
    console.log("Sample orphaned orders:");
    console.log(JSON.stringify(orphanedOrders.slice(0, 20), null, 2));
  }

  if (itemsCount > 0) {
    console.log("Sample orphaned order items:");
    console.log(JSON.stringify(orphanedOrderItems.slice(0, 20), null, 2));
  }

  if (fulfillmentsCount > 0) {
    console.log("Sample orphaned fulfillments:");
    console.log(JSON.stringify(orphanedFulfillments.slice(0, 20), null, 2));
  }

  if (ordersCount + itemsCount + fulfillmentsCount > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error("Failed to audit orphaned orders", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
