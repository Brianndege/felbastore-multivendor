import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { enqueueOutboxEvent } from "@/lib/outbox";
import { sendOrderStatusEmailToUser } from "@/lib/email";
import { canTransitionOrderStatus, isLifecycleStatus } from "@/lib/order-lifecycle";

const prismaUnsafe = prisma as any;

const VENDOR_ALLOWED_STATUSES = new Set(["confirmed", "processing", "shipped", "in_transit", "delivered", "cancelled"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orderId = typeof req.query.id === "string" ? req.query.id : "";
  const nextStatus = typeof req.body?.status === "string" ? req.body.status.trim().toLowerCase() : "";
  const shippingProvider = typeof req.body?.shippingProvider === "string" ? req.body.shippingProvider.trim() : "";
  const trackingNumber = typeof req.body?.trackingNumber === "string" ? req.body.trackingNumber.trim() : "";
  const trackingUrl = typeof req.body?.trackingUrl === "string" ? req.body.trackingUrl.trim() : "";
  const estimatedDeliveryAtRaw = typeof req.body?.estimatedDeliveryAt === "string" ? req.body.estimatedDeliveryAt : "";

  if (!orderId || !isLifecycleStatus(nextStatus) || !VENDOR_ALLOWED_STATUSES.has(nextStatus)) {
    return res.status(400).json({ error: "Invalid order id or status" });
  }

  const vendorId = session.user.id;

  try {
    const order = await prismaUnsafe.order.findFirst({
      where: {
        id: orderId,
        orderItems: {
          some: {
            vendorId,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const fulfillment = await prismaUnsafe.orderVendorFulfillment.findUnique({
      where: {
        orderId_vendorId: {
          orderId: order.id,
          vendorId,
        },
      },
    });

    if (!fulfillment) {
      return res.status(404).json({ error: "Vendor fulfillment record not found" });
    }

    const currentStatus = fulfillment.orderStatus.toLowerCase();
    if (!canTransitionOrderStatus(currentStatus, nextStatus)) {
      return res.status(400).json({
        error: `Cannot update order from ${currentStatus} to ${nextStatus}`,
      });
    }

    if (nextStatus === "shipped" && (!shippingProvider || !trackingNumber)) {
      return res.status(400).json({
        error: "shippingProvider and trackingNumber are required when marking as shipped",
      });
    }

    const timestampData: Record<string, Date> = {};
    if (nextStatus === "confirmed") timestampData.confirmedAt = new Date();
    if (nextStatus === "processing") timestampData.processingAt = new Date();
    if (nextStatus === "shipped") timestampData.shippedAt = new Date();
    if (nextStatus === "in_transit") timestampData.inTransitAt = new Date();
    if (nextStatus === "delivered") timestampData.deliveredAt = new Date();
    if (nextStatus === "cancelled") timestampData.cancelledAt = new Date();

    const estimatedDeliveryAt = estimatedDeliveryAtRaw ? new Date(estimatedDeliveryAtRaw) : null;
    const updateData: Record<string, unknown> = {
      orderStatus: nextStatus.toUpperCase(),
      ...timestampData,
    };

    if (nextStatus === "confirmed") {
      updateData.acknowledgedAt = new Date();
    }

    if (nextStatus === "shipped") {
      updateData.shippingStatus = "SHIPPED";
      updateData.shippingProvider = shippingProvider;
      updateData.trackingNumber = trackingNumber;
      updateData.trackingUrl = trackingUrl || null;
      updateData.estimatedDeliveryAt = estimatedDeliveryAt;
    }

    if (nextStatus === "in_transit") {
      updateData.shippingStatus = "IN_TRANSIT";
    }

    if (nextStatus === "delivered") {
      updateData.shippingStatus = "DELIVERED";
    }

    const updated = await prismaUnsafe.orderVendorFulfillment.update({
      where: {
        orderId_vendorId: {
          orderId: order.id,
          vendorId,
        },
      },
      data: updateData,
    });

    await prismaUnsafe.orderStatusAudit.create({
      data: {
        orderId: order.id,
        vendorId,
        fromStatus: currentStatus.toUpperCase(),
        toStatus: nextStatus.toUpperCase(),
        actorRole: "vendor",
        actorId: vendorId,
        metadata: JSON.stringify({
          shippingProvider: shippingProvider || null,
          trackingNumber: trackingNumber || null,
          trackingUrl: trackingUrl || null,
          estimatedDeliveryAt: estimatedDeliveryAt?.toISOString() || null,
        }),
      },
    });

    await prismaUnsafe.notification.create({
      data: {
        userId: order.userId,
        type: "order",
        priority: nextStatus === "cancelled" ? "high" : "normal",
        title: "Order Status Updated",
        message: `Your order #${order.orderNumber} status is now ${nextStatus}.`,
        data: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: nextStatus,
          updatedBy: "vendor",
        }),
      },
    });

    await enqueueOutboxEvent({
      topic: "order.status.updated",
      entityType: "order",
      entityId: order.id,
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        previousStatus: currentStatus,
        status: nextStatus,
        updatedBy: "vendor",
        vendorId,
        userId: order.userId,
        trackingNumber: trackingNumber || undefined,
        shippingProvider: shippingProvider || undefined,
        trackingUrl: trackingUrl || undefined,
        updatedAt: new Date().toISOString(),
      },
    });

    if (order.user.email) {
      await sendOrderStatusEmailToUser({
        email: order.user.email,
        customerName: order.user.name || "Customer",
        orderNumber: order.orderNumber,
        status: nextStatus,
      });
    }

    return res.status(200).json({
      message: "Order status updated successfully",
      order: {
        id: updated.orderId,
        status: updated.orderStatus.toLowerCase(),
        shippingStatus: updated.shippingStatus.toLowerCase(),
        trackingNumber: updated.trackingNumber,
        shippingProvider: updated.shippingProvider,
        trackingUrl: updated.trackingUrl,
        estimatedDeliveryAt: updated.estimatedDeliveryAt,
      },
    });
  } catch (error) {
    console.error("Error updating vendor order status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
