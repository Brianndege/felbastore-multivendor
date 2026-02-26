import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "POST"].includes(req.method || "")) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const dbHealthcheckKey = process.env.DB_HEALTHCHECK_KEY;
  const providedKey =
    req.headers["x-db-health-key"] ||
    (typeof req.query.key === "string" ? req.query.key : undefined);

  if (process.env.NODE_ENV === "production") {
    if (!dbHealthcheckKey) {
      return res.status(403).json({
        success: false,
        error: "DB health check is disabled in production (missing DB_HEALTHCHECK_KEY).",
      });
    }

    if (providedKey !== dbHealthcheckKey) {
      return res.status(401).json({ success: false, error: "Invalid health check key." });
    }
  }

  console.log("[test-db] Starting comprehensive database write health check...");

  const steps: Record<string, string> = {};
  const createdIds: {
    userId?: string;
    vendorId?: string;
    productId?: string;
    cartItemId?: string;
    orderId?: string;
    notificationId?: string;
    inventoryAlertId?: string;
  } = {};

  const suffix = Date.now();
  const testUserEmail = `db-health-user-${suffix}@example.com`;
  const testVendorEmail = `db-health-vendor-${suffix}@example.com`;

  try {
    console.log("[test-db] Step 1: Checking base connectivity...");
    const userCount = await prisma.user.count();
    const vendorCount = await prisma.vendor.count();
    const productCount = await prisma.product.count();
    steps.connection = "✓ Connected";

    console.log("[test-db] Step 2: Creating test user...");
    const testUser = await prisma.user.create({
      data: {
        name: "DB Health User",
        email: testUserEmail,
        password: "test-password-hashed",
        role: "user",
      },
    });
    createdIds.userId = testUser.id;
    steps.userCreate = "✓ User write works";

    console.log("[test-db] Step 3: Creating test vendor...");
    const testVendor = await prisma.vendor.create({
      data: {
        name: "DB Health Vendor",
        email: testVendorEmail,
        password: "test-password-hashed",
        storeName: `DB Health Store ${suffix}`,
        role: "vendor",
      },
    });
    createdIds.vendorId = testVendor.id;
    steps.vendorCreate = "✓ Vendor write works";

    console.log("[test-db] Step 4: Creating test product...");
    const testProduct = await prisma.product.create({
      data: {
        vendorId: testVendor.id,
        name: "DB Health Product",
        description: "Temporary product for DB write health check",
        price: 19.99,
        category: "HealthCheck",
        tags: ["db", "health"],
        images: [],
        inventory: 50,
        status: "active",
      },
    });
    createdIds.productId = testProduct.id;
    steps.productCreate = "✓ Product write works";

    console.log("[test-db] Step 5: Creating test cart item...");
    const testCartItem = await prisma.cartItem.create({
      data: {
        userId: testUser.id,
        productId: testProduct.id,
        quantity: 2,
      },
    });
    createdIds.cartItemId = testCartItem.id;
    steps.cartWrite = "✓ Cart write works";

    console.log("[test-db] Step 6: Creating test order and order item...");
    const testOrder = await prisma.order.create({
      data: {
        orderNumber: `HC-${suffix}`,
        userId: testUser.id,
        status: "pending",
        totalAmount: 43.98,
        shippingAmount: 0,
        taxAmount: 4,
        discountAmount: 0,
        paymentStatus: "pending",
        paymentMethod: "health-check",
        shippingAddress: JSON.stringify({
          address: "123 Test Street",
          city: "Nairobi",
          country: "Kenya",
          zipCode: "00100",
        }),
        billingAddress: JSON.stringify({
          address: "123 Test Street",
          city: "Nairobi",
          country: "Kenya",
          zipCode: "00100",
        }),
        orderItems: {
          create: [
            {
              productId: testProduct.id,
              vendorId: testVendor.id,
              quantity: 2,
              price: 19.99,
              productName: testProduct.name,
              productImage: null,
            },
          ],
        },
      },
    });
    createdIds.orderId = testOrder.id;
    steps.orderWrite = "✓ Order write works";

    console.log("[test-db] Step 7: Writing notification and inventory alert...");
    const notification = await prisma.notification.create({
      data: {
        userId: testUser.id,
        type: "system",
        title: "DB Health Notification",
        message: "Notification write check successful",
        data: JSON.stringify({ source: "test-db" }),
      },
    });
    createdIds.notificationId = notification.id;

    const inventoryAlert = await prisma.inventoryAlert.create({
      data: {
        vendorId: testVendor.id,
        productId: testProduct.id,
        type: "low_stock",
        threshold: 10,
        currentStock: 8,
        message: "Inventory alert write check successful",
      },
    });
    createdIds.inventoryAlertId = inventoryAlert.id;
    steps.notificationAndAlertWrite = "✓ Notification + inventory alert writes work";

    console.log("[test-db] Step 8: Product update write check...");
    await prisma.product.update({
      where: { id: testProduct.id },
      data: { inventory: { decrement: 1 } },
    });
    steps.updateWrite = "✓ Update writes work";

    console.log("[test-db] Step 9: Query sanity check...");
    const sampleVendors = await prisma.vendor.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        storeName: true,
      },
    });
    console.log('[test-db] Found', vendors.length, 'vendors');

    // Test 4: Check products
    console.log('[test-db] Test 4: Testing product query...');
    const productCount = await prisma.product.count();
    console.log('[test-db] Found', productCount, 'products');

    console.log('[test-db] All tests passed successfully!');

    return res.status(200).json({
      success: true,
      message: "Database connectivity test passed",
      results: {
        connection: "✓ Connected",
        userCount,
    steps.queryRead = "✓ Read queries work";
        productCount,
    console.log("[test-db] All health-check writes passed. Starting cleanup...");

    if (createdIds.orderId) {
      await prisma.order.delete({ where: { id: createdIds.orderId } });
      createdIds.orderId = undefined;
    }

    if (createdIds.cartItemId) {
      await prisma.cartItem.delete({ where: { id: createdIds.cartItemId } }).catch(() => {});
      createdIds.cartItemId = undefined;
    }

    if (createdIds.inventoryAlertId) {
      await prisma.inventoryAlert.delete({ where: { id: createdIds.inventoryAlertId } }).catch(() => {});
      createdIds.inventoryAlertId = undefined;
    }

    if (createdIds.notificationId) {
      await prisma.notification.delete({ where: { id: createdIds.notificationId } }).catch(() => {});
      createdIds.notificationId = undefined;
    }

    if (createdIds.productId) {
      await prisma.product.delete({ where: { id: createdIds.productId } });
      createdIds.productId = undefined;
    }

    if (createdIds.vendorId) {
      await prisma.vendor.delete({ where: { id: createdIds.vendorId } });
      createdIds.vendorId = undefined;
    }

    if (createdIds.userId) {
      await prisma.user.delete({ where: { id: createdIds.userId } });
      createdIds.userId = undefined;
    }

    steps.cleanup = "✓ Cleanup successful";
    });
  } catch (error) {
    console.error('[test-db] Database test failed:', error);
      message: "Database write health check passed",
      message: error instanceof Error ? error.message : 'Unknown error',
        ...steps,
      error,
    });

        sampleVendors,
      timestamp: new Date().toISOString(),
    });
  }
}
    console.error("[test-db] Health check failed:", error);

    if (createdIds.orderId) {
      await prisma.order.delete({ where: { id: createdIds.orderId } }).catch(() => {});
    }
    if (createdIds.cartItemId) {
      await prisma.cartItem.delete({ where: { id: createdIds.cartItemId } }).catch(() => {});
    }
    if (createdIds.inventoryAlertId) {
      await prisma.inventoryAlert.delete({ where: { id: createdIds.inventoryAlertId } }).catch(() => {});
    }
    if (createdIds.notificationId) {
      await prisma.notification.delete({ where: { id: createdIds.notificationId } }).catch(() => {});
    }
    if (createdIds.productId) {
      await prisma.product.delete({ where: { id: createdIds.productId } }).catch(() => {});
    }
    if (createdIds.vendorId) {
      await prisma.vendor.delete({ where: { id: createdIds.vendorId } }).catch(() => {});
    }
    if (createdIds.userId) {
      await prisma.user.delete({ where: { id: createdIds.userId } }).catch(() => {});
    }

    return res.status(500).json({
      success: false,
      error: "Database write health check failed",
      details: error instanceof Error ? error.message : "Unknown error",
      steps,
      timestamp: new Date().toISOString(),
    });
  }
}
