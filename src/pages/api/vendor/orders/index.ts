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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const vendorId = session.user.id;
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
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                currency: true,
              },
            },
            vendor: {
              select: {
                id: true,
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

    const payload: VendorOrderSummary[] = [];

    for (const order of orders) {
      const vendorItems = order.orderItems.filter((item: any) => item.vendorId === vendorId);
      const vendorAmount = vendorItems.reduce((sum: number, item: any) => sum + Number(item.price) * item.quantity, 0);
      const currency = vendorItems[0]?.product?.currency || "KES";
      const canUpdateStatus = order.orderItems.every((item: any) => item.vendorId === vendorId);
      const fulfillment = order.vendorFulfillments[0];
      if (!fulfillment) {
        continue;
      }

      payload.push({
        id: order.id,
        orderNumber: order.orderNumber,
        status: fulfillment.orderStatus.toLowerCase(),
        shippingStatus: fulfillment.shippingStatus.toLowerCase(),
        trackingNumber: fulfillment.trackingNumber,
        shippingProvider: fulfillment.shippingProvider,
        trackingUrl: fulfillment.trackingUrl,
        estimatedDeliveryAt: fulfillment.estimatedDeliveryAt,
        confirmationDueAt: fulfillment.confirmationDueAt,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        totalAmount: Number(order.totalAmount),
        vendorAmount: Number(vendorAmount.toFixed(2)),
        currency,
        itemCount: vendorItems.reduce((sum: number, item: any) => sum + item.quantity, 0),
        customer: {
          name: order.user?.name || "Customer",
          email: order.user?.email || "",
        },
        canUpdateStatus,
      });
    }

    const filteredPayload = payload.filter((entry) =>
      requestedStatus && requestedStatus !== "all" ? entry.status === requestedStatus : true
    );

    return res.status(200).json({ orders: filteredPayload });
  } catch (error) {
    console.error("Error fetching vendor orders:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
