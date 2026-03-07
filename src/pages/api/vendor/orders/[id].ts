import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

const prismaUnsafe = prisma as any;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orderId = typeof req.query.id === "string" ? req.query.id : "";
  if (!orderId) {
    return res.status(400).json({ error: "Invalid order id" });
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
            name: true,
            email: true,
            phone: true,
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                currency: true,
              },
            },
          },
        },
        vendorFulfillments: {
          where: { vendorId },
          take: 1,
        },
        statusAudits: {
          where: {
            OR: [{ vendorId }, { vendorId: null }],
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const vendorItems = order.orderItems.filter((item: any) => item.vendorId === vendorId);
    const canUpdateStatus = order.orderItems.every((item: any) => item.vendorId === vendorId);
    const fulfillment = order.vendorFulfillments[0];

    if (!fulfillment) {
      return res.status(404).json({ error: "Vendor fulfillment record not found" });
    }

    let shippingAddress: Record<string, unknown> | null = null;
    let billingAddress: Record<string, unknown> | null = null;

    try {
      shippingAddress = JSON.parse(order.shippingAddress);
    } catch {
      shippingAddress = null;
    }

    try {
      billingAddress = JSON.parse(order.billingAddress);
    } catch {
      billingAddress = null;
    }

    const vendorAmount = vendorItems.reduce((sum: number, item: any) => sum + Number(item.price) * item.quantity, 0);
    const currency = vendorItems[0]?.product?.currency || "KES";

    return res.status(200).json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: fulfillment.orderStatus.toLowerCase(),
        shippingStatus: fulfillment.shippingStatus.toLowerCase(),
        trackingNumber: fulfillment.trackingNumber,
        shippingProvider: fulfillment.shippingProvider,
        trackingUrl: fulfillment.trackingUrl,
        estimatedDeliveryAt: fulfillment.estimatedDeliveryAt,
        confirmationDueAt: fulfillment.confirmationDueAt,
        acknowledgedAt: fulfillment.acknowledgedAt,
        confirmedAt: fulfillment.confirmedAt,
        processingAt: fulfillment.processingAt,
        shippedAt: fulfillment.shippedAt,
        inTransitAt: fulfillment.inTransitAt,
        deliveredAt: fulfillment.deliveredAt,
        completedAt: fulfillment.completedAt,
        cancelledAt: fulfillment.cancelledAt,
        refundedAt: fulfillment.refundedAt,
        disputeOpenedAt: fulfillment.disputeOpenedAt,
        disputeResolvedAt: fulfillment.disputeResolvedAt,
        disputeReason: fulfillment.disputeReason,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        notes: order.notes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        totalAmount: Number(order.totalAmount),
        vendorAmount: Number(vendorAmount.toFixed(2)),
        currency,
        canUpdateStatus,
        customer: {
          id: order.user.id,
          name: order.user.name || "Customer",
          email: order.user.email,
          phone: order.user.phone,
        },
        shippingAddress,
        billingAddress,
        orderItems: vendorItems.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          price: Number(item.price),
          productName: item.productName,
          productImage: item.productImage,
          currency: item.product?.currency || currency,
          product: item.product,
        })),
        timeline: order.statusAudits.map((entry: any) => ({
          id: entry.id,
          fromStatus: entry.fromStatus?.toLowerCase() || null,
          toStatus: entry.toStatus.toLowerCase(),
          actorRole: entry.actorRole,
          actorId: entry.actorId,
          note: entry.note,
          metadata: entry.metadata,
          createdAt: entry.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching vendor order details:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
