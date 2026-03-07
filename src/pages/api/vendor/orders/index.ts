import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

const prismaUnsafe = prisma as any;

type VendorOrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  shippingStatus: string;
  trackingNumber?: string | null;
  shippingProvider?: string | null;
  trackingUrl?: string | null;
  estimatedDeliveryAt?: Date | null;
  confirmationDueAt?: Date | null;
  paymentStatus: string;
  createdAt: Date;
  totalAmount: number;
  vendorAmount: number;
  currency: string;
  itemCount: number;
  customer: {
    name: string;
    email: string;
  };
  canUpdateStatus: boolean;
};

function normalizeLifecycleStatus(value: unknown, fallback = "pending"): string {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized || fallback;
}

function deriveShippingStatus(orderStatus: string): string {
  if (orderStatus === "shipped") return "shipped";
  if (orderStatus === "in_transit") return "in_transit";
  if (orderStatus === "delivered") return "delivered";
  return "pending";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const vendorId = typeof session.user.id === "string" ? session.user.id.trim() : "";
  if (!vendorId) {
    return res.status(400).json({
      error: "Invalid vendor session",
      code: "INVALID_VENDOR_SESSION",
    });
  }

  const requestedStatus = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "";

  try {
    const orders = await prismaUnsafe.order.findMany({
      where: {
        orderItems: {
          some: {
            vendorId,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                currency: true,
              },
            },
          },
        },
        vendorFulfillments: {
          where: { vendorId },
          take: 1,
        },
      },
      take: 100,
    });

    const userIds = Array.from(
      new Set<string>(
        orders
          .map((order: any): string | null => (typeof order?.userId === "string" ? order.userId : null))
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [];

    const userById = new Map(users.map((user) => [user.id, user]));

    const payload: VendorOrderSummary[] = [];
    let skippedOrders = 0;

    for (const order of orders) {
      try {
        const vendorItems = Array.isArray(order.orderItems)
          ? order.orderItems.filter((item: any) => item?.vendorId === vendorId)
          : [];
        if (vendorItems.length === 0) {
          skippedOrders += 1;
          continue;
        }

        const vendorAmount = vendorItems.reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
        const currency = vendorItems[0]?.product?.currency || "KES";
        const canUpdateStatus = order.orderItems.every((item: any) => item?.vendorId === vendorId);
        const fulfillment = order.vendorFulfillments?.[0];

        const status = normalizeLifecycleStatus(fulfillment?.orderStatus, normalizeLifecycleStatus(order.status, "pending"));
        const shippingStatus = normalizeLifecycleStatus(
          fulfillment?.shippingStatus,
          deriveShippingStatus(status)
        );

        payload.push({
          id: order.id,
          orderNumber: order.orderNumber,
          status,
          shippingStatus,
          trackingNumber: fulfillment?.trackingNumber || null,
          shippingProvider: fulfillment?.shippingProvider || null,
          trackingUrl: fulfillment?.trackingUrl || null,
          estimatedDeliveryAt: fulfillment?.estimatedDeliveryAt || null,
          confirmationDueAt: fulfillment?.confirmationDueAt || null,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          totalAmount: Number(order.totalAmount),
          vendorAmount: Number(vendorAmount.toFixed(2)),
          currency,
          itemCount: vendorItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0),
          customer: {
            name: userById.get(order.userId)?.name || "Customer",
            email: userById.get(order.userId)?.email || "",
          },
          canUpdateStatus,
        });
      } catch (rowError) {
        skippedOrders += 1;
        console.error("Error shaping vendor order row:", {
          orderId: order?.id,
          vendorId,
          reason: rowError instanceof Error ? rowError.message : "unknown_row_error",
        });
      }
    }

    const filteredPayload = payload.filter((entry) =>
      requestedStatus && requestedStatus !== "all" ? entry.status === requestedStatus : true
    );

    return res.status(200).json({
      orders: filteredPayload,
      meta: {
        totalMatchedOrders: payload.length,
        skippedOrders,
      },
    });
  } catch (error) {
    console.error("Error fetching vendor orders:", {
      vendorId,
      requestedStatus,
      reason: error instanceof Error ? error.message : "unknown_vendor_orders_error",
    });
    return res.status(500).json({
      error: "Failed to fetch vendor orders",
      code: "VENDOR_ORDERS_FETCH_FAILED",
    });
  }
}
