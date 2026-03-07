import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { canTransitionOrderStatus } from "@/lib/order-lifecycle";

const prismaUnsafe = prisma as any;

type LifecycleAction = "confirm_receipt" | "open_dispute" | "request_refund";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orderId = typeof req.query.id === "string" ? req.query.id : "";
  const vendorId = typeof req.body?.vendorId === "string" ? req.body.vendorId : "";
  const action = typeof req.body?.action === "string" ? (req.body.action as LifecycleAction) : "";
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  if (!orderId || !vendorId || !action) {
    return res.status(400).json({ error: "orderId, vendorId and action are required" });
  }

  if (!(["confirm_receipt", "open_dispute", "request_refund"] as const).includes(action)) {
    return res.status(400).json({ error: "Unsupported lifecycle action" });
  }

  const order = await prismaUnsafe.order.findFirst({
    where: { id: orderId, userId: session.user.id },
    select: { id: true, orderNumber: true, userId: true },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  const fulfillment = await prismaUnsafe.orderVendorFulfillment.findUnique({
    where: {
      orderId_vendorId: {
        orderId,
        vendorId,
      },
    },
  });

  if (!fulfillment) {
    return res.status(404).json({ error: "Vendor fulfillment not found" });
  }

  const now = new Date();
  const currentStatus = fulfillment.orderStatus.toLowerCase();

  if (action === "confirm_receipt") {
    if (!canTransitionOrderStatus(currentStatus, "completed") && currentStatus !== "completed") {
      return res.status(400).json({ error: `Cannot confirm receipt from status ${currentStatus}` });
    }

    const updated = await prismaUnsafe.orderVendorFulfillment.update({
      where: {
        orderId_vendorId: {
          orderId,
          vendorId,
        },
      },
      data: {
        orderStatus: "COMPLETED",
        completedAt: fulfillment.completedAt || now,
        payoutReleasedAt: now,
      },
    });

    await prismaUnsafe.orderStatusAudit.create({
      data: {
        orderId,
        vendorId,
        fromStatus: fulfillment.orderStatus,
        toStatus: "COMPLETED",
        actorRole: "customer",
        actorId: session.user.id,
        note: "Customer confirmed receipt",
      },
    });

    await prismaUnsafe.notification.create({
      data: {
        vendorId,
        type: "order",
        title: "Order Completed",
        message: `Customer confirmed receipt for order #${order.orderNumber}.`,
        data: JSON.stringify({ orderId, vendorId, action }),
      },
    });

    return res.status(200).json({
      success: true,
      fulfillment: {
        status: updated.orderStatus.toLowerCase(),
        completedAt: updated.completedAt,
      },
    });
  }

  if (action === "open_dispute") {
    const updated = await prismaUnsafe.orderVendorFulfillment.update({
      where: {
        orderId_vendorId: {
          orderId,
          vendorId,
        },
      },
      data: {
        disputeOpenedAt: now,
        disputeResolvedAt: null,
        disputeReason: reason || "Customer opened dispute",
        payoutFrozenAt: now,
        payoutFreezeReason: reason || "Dispute opened",
      },
    });

    await prismaUnsafe.orderStatusAudit.create({
      data: {
        orderId,
        vendorId,
        fromStatus: fulfillment.orderStatus,
        toStatus: fulfillment.orderStatus,
        actorRole: "customer",
        actorId: session.user.id,
        note: "Customer opened dispute",
        metadata: JSON.stringify({ reason: reason || null }),
      },
    });

    await prismaUnsafe.notification.create({
      data: {
        vendorId,
        type: "dispute",
        priority: "high",
        title: "Dispute Opened",
        message: `Customer opened a dispute for order #${order.orderNumber}.`,
        data: JSON.stringify({ orderId, vendorId, reason: reason || null }),
      },
    });

    return res.status(200).json({
      success: true,
      fulfillment: {
        status: updated.orderStatus.toLowerCase(),
        disputeOpenedAt: updated.disputeOpenedAt,
        payoutFrozenAt: updated.payoutFrozenAt,
      },
    });
  }

  // request_refund
  if (!canTransitionOrderStatus(currentStatus, "refunded") && currentStatus !== "refunded") {
    return res.status(400).json({ error: `Cannot request refund from status ${currentStatus}` });
  }

  const updated = await prismaUnsafe.orderVendorFulfillment.update({
    where: {
      orderId_vendorId: {
        orderId,
        vendorId,
      },
    },
    data: {
      orderStatus: "REFUNDED",
      refundedAt: now,
      payoutFrozenAt: now,
      payoutFreezeReason: reason || "Refund requested",
    },
  });

  await prismaUnsafe.orderStatusAudit.create({
    data: {
      orderId,
      vendorId,
      fromStatus: fulfillment.orderStatus,
      toStatus: "REFUNDED",
      actorRole: "customer",
      actorId: session.user.id,
      note: "Customer requested refund",
      metadata: JSON.stringify({ reason: reason || null }),
    },
  });

  await prismaUnsafe.notification.create({
    data: {
      vendorId,
      type: "refund",
      priority: "high",
      title: "Refund Requested",
      message: `Customer requested refund for order #${order.orderNumber}.`,
      data: JSON.stringify({ orderId, vendorId, reason: reason || null }),
    },
  });

  return res.status(200).json({
    success: true,
    fulfillment: {
      status: updated.orderStatus.toLowerCase(),
      refundedAt: updated.refundedAt,
      payoutFrozenAt: updated.payoutFrozenAt,
    },
  });
}
