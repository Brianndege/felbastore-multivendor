"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import type { OrderStatus, ShippingLifecycleStatus } from "@prisma/client";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { ensureOrderLifecycleSchemaCompatibility } from "@/lib/orders/schema-compat";
import { sendNotification } from "@/lib/orders/notifications";
import { releaseVendorPayout } from "@/lib/orders/payout";

const transitionSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "COMPLETED"]),
  shippingProvider: z.string().trim().optional(),
  trackingNumber: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED"],
  CONFIRMED: ["PROCESSING"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["IN_TRANSIT"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const SHIPPING_BY_STATUS: Partial<Record<OrderStatus, ShippingLifecycleStatus>> = {
  SHIPPED: "SHIPPED",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
};

function toLegacyStatus(status: OrderStatus) {
  return status.toLowerCase();
}

export async function updateOrderStatus(input: {
  orderId: string;
  status: OrderStatus;
  shippingProvider?: string;
  trackingNumber?: string;
  note?: string;
}) {
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid status update payload");
  }

  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "vendor") {
    throw new Error("Unauthorized");
  }

  await ensureOrderLifecycleSchemaCompatibility();

  const vendorId = session.user.id;
  const { orderId, status, shippingProvider, trackingNumber, note } = parsed.data;

  const fulfillment = await prisma.orderVendorFulfillment.findUnique({
    where: {
      orderId_vendorId: {
        orderId,
        vendorId,
      },
    },
    include: {
      order: {
        select: {
          id: true,
          userId: true,
          orderNumber: true,
        },
      },
    },
  });

  if (!fulfillment || !fulfillment.order) {
    throw new Error("Order not found for this vendor");
  }

  const currentStatus = fulfillment.orderStatus as OrderStatus;
  const allowed = ORDER_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(status)) {
    throw new Error(`Invalid lifecycle transition ${currentStatus} -> ${status}`);
  }

  if (status === "SHIPPED" && (!trackingNumber || !trackingNumber.trim())) {
    throw new Error("trackingNumber is required when moving to SHIPPED");
  }

  const now = new Date();
  const orderTimestampData: Record<string, Date> = {};
  const fulfillmentTimestampData: Record<string, Date> = {};

  if (status === "CONFIRMED") {
    orderTimestampData.confirmedAt = now;
    fulfillmentTimestampData.confirmedAt = now;
  }
  if (status === "PROCESSING") {
    orderTimestampData.processedAt = now;
    fulfillmentTimestampData.processingAt = now;
  }
  if (status === "SHIPPED") {
    orderTimestampData.shippedAt = now;
    fulfillmentTimestampData.shippedAt = now;
  }
  if (status === "IN_TRANSIT") {
    fulfillmentTimestampData.inTransitAt = now;
  }
  if (status === "DELIVERED") {
    orderTimestampData.deliveredAt = now;
    fulfillmentTimestampData.deliveredAt = now;
  }
  if (status === "COMPLETED") {
    fulfillmentTimestampData.completedAt = now;
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderVendorFulfillment.update({
      where: {
        orderId_vendorId: {
          orderId,
          vendorId,
        },
      },
      data: {
        orderStatus: status,
        ...(SHIPPING_BY_STATUS[status] ? { shippingStatus: SHIPPING_BY_STATUS[status] } : {}),
        ...(status === "SHIPPED"
          ? {
              shippingProvider: shippingProvider?.trim() || null,
              trackingNumber: trackingNumber?.trim() || null,
            }
          : {}),
        ...fulfillmentTimestampData,
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        vendorId,
        customerId: fulfillment.order.userId,
        lifecycleStatus: status,
        status: toLegacyStatus(status),
        ...(status === "SHIPPED"
          ? {
              shippingProvider: shippingProvider?.trim() || null,
              trackingNumber: trackingNumber?.trim() || null,
            }
          : {}),
        ...orderTimestampData,
      },
    });

    await tx.orderStatusAudit.create({
      data: {
        orderId,
        vendorId,
        fromStatus: currentStatus,
        toStatus: status,
        actorRole: "vendor",
        actorId: vendorId,
        note: note || null,
      },
    });

    await tx.orderLog.create({
      data: {
        orderId,
        vendorId,
        actorUserId: null,
        actorRole: "vendor",
        fromStatus: currentStatus,
        toStatus: status,
        note: note || null,
      },
    });
  });

  if (status === "COMPLETED") {
    await releaseVendorPayout({ orderId, vendorId });
  }

  await sendNotification({
    userId: fulfillment.order.userId,
    type: "order",
    priority: status === "COMPLETED" ? "high" : "normal",
    title: "Order Status Updated",
    message: `Your order #${fulfillment.order.orderNumber} is now ${status.replace(/_/g, " ").toLowerCase()}.`,
    data: {
      orderId,
      orderNumber: fulfillment.order.orderNumber,
      status,
      vendorId,
    },
  });

  revalidatePath("/vendors/dashboard/orders");
  revalidatePath(`/vendors/dashboard/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}`);

  return { ok: true, orderId, status };
}
