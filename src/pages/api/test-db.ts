import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

type HealthResponse = {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  steps?: Record<string, string>;
  results?: Record<string, unknown>;
  timestamp: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  if (!req.method || !["GET", "POST"].includes(req.method)) {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      timestamp: new Date().toISOString(),
    });
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
        timestamp: new Date().toISOString(),
      });
    }

    if (providedKey !== dbHealthcheckKey) {
      return res.status(401).json({
        success: false,
        error: "Invalid health check key.",
        timestamp: new Date().toISOString(),
      });
    }
  }

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
    const userCount = await prisma.user.count();
    const vendorCount = await prisma.vendor.count();
    const productCount = await prisma.product.count();
    steps.connection = "✓ Connected";

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

    const testCartItem = await prisma.cartItem.create({
      data: {
        userId: testUser.id,
        productId: testProduct.id,
        quantity: 2,
      },
    });
    createdIds.cartItemId = testCartItem.id;
    steps.cartWrite = "✓ Cart write works";

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
            },
          ],
        },
      },
    });
    createdIds.orderId = testOrder.id;
    steps.orderWrite = "✓ Order write works";

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

    await prisma.product.update({
      where: { id: testProduct.id },
      data: { inventory: { decrement: 1 } },
    });
    steps.updateWrite = "✓ Update writes work";

    const sampleVendors = await prisma.vendor.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        storeName: true,
      },
    });
    steps.queryRead = "✓ Read queries work";

    if (createdIds.orderId) {
      await prisma.order.delete({ where: { id: createdIds.orderId } });
      createdIds.orderId = undefined;
    }

    if (createdIds.cartItemId) {
      await prisma.cartItem.delete({ where: { id: createdIds.cartItemId } }).catch(() => {});
      createdIds.cartItemId = undefined;
    }

    if (createdIds.inventoryAlertId) {
      await prisma.inventoryAlert
        .delete({ where: { id: createdIds.inventoryAlertId } })
        .catch(() => {});
      createdIds.inventoryAlertId = undefined;
    }

    if (createdIds.notificationId) {
      await prisma.notification
        .delete({ where: { id: createdIds.notificationId } })
        .catch(() => {});
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

    return res.status(200).json({
      success: true,
      message: "Database write health check passed",
      results: {
        userCount,
        vendorCount,
        productCount,
        sampleVendors,
      },
      steps,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
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
