import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const prismaUnsafe = prisma as any;

function logPrismaError(context: string, error: unknown, extra?: Record<string, unknown>) {
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError) {
    console.error(`[${context}] Prisma error`, {
      ...extra,
      name: error.name,
      message: error.message,
      code: (error as Prisma.PrismaClientKnownRequestError).code,
      meta: (error as Prisma.PrismaClientKnownRequestError).meta,
      clientVersion: error.clientVersion,
      stack: error.stack,
    });
    return;
  }

  if (error instanceof Error) {
    console.error(`[${context}] Error`, {
      ...extra,
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  console.error(`[${context}] Unknown error`, {
    ...extra,
    error,
  });
}

async function fetchOrdersWithFallback(vendorId: string) {
  try {
    return await prismaUnsafe.order.findMany({
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
  } catch (error) {
    logPrismaError("vendor/orders/findMany-primary", error, { vendorId });

    // Fallback query is resilient to relation/include drift in partially migrated environments.
    return prismaUnsafe.order.findMany({
      where: {
        orderItems: {
          some: {
            vendorId,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        orderItems: true,
      },
      take: 100,
    });
  }
}

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

const VendorOrderSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().min(1),
  status: z.string().min(1),
  shippingStatus: z.string().min(1),
  trackingNumber: z.string().nullable().optional(),
  shippingProvider: z.string().nullable().optional(),
  trackingUrl: z.string().nullable().optional(),
  estimatedDeliveryAt: z.date().nullable().optional(),
  confirmationDueAt: z.date().nullable().optional(),
  paymentStatus: z.string().min(1),
  createdAt: z.date(),
  totalAmount: z.number(),
  vendorAmount: z.number(),
  currency: z.string().min(1),
  itemCount: z.number().int().nonnegative(),
  customer: z.object({
    name: z.string().min(1),
    email: z.string(),
  }),
  canUpdateStatus: z.boolean(),
});

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
    const orders = await fetchOrdersWithFallback(vendorId);

    const collectedUserIds: string[] = [];
    for (const order of orders) {
      if (typeof order?.userId === "string" && order.userId.length > 0) {
        collectedUserIds.push(order.userId);
      }
    }
    const userIds: string[] = Array.from(new Set(collectedUserIds));

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

        const vendorAmount = vendorItems.reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
        const currency = vendorItems[0]?.product?.currency || "KES";
        const canUpdateStatus = Array.isArray(order.orderItems)
          ? order.orderItems.every((item: any) => item?.vendorId === vendorId)
          : false;
        const fulfillment = Array.isArray(order.vendorFulfillments) ? order.vendorFulfillments[0] : undefined;

        const status = normalizeLifecycleStatus(fulfillment?.orderStatus, normalizeLifecycleStatus(order.status, "pending"));
        const shippingStatus = normalizeLifecycleStatus(
          fulfillment?.shippingStatus,
          deriveShippingStatus(status)
        );

        const mapped: VendorOrderSummary = {
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
            name: userById.get(order.userId)?.name || "Deleted User",
            email: userById.get(order.userId)?.email || "",
          },
          canUpdateStatus,
        };

        const parsed = VendorOrderSchema.safeParse(mapped);
        if (!parsed.success) {
          skippedOrders += 1;
          console.error("Invalid vendor order payload shape:", {
            orderId: order?.id,
            vendorId,
            issues: parsed.error.issues,
          });
          continue;
        }

        payload.push(parsed.data);
      } catch (rowError) {
        skippedOrders += 1;
        logPrismaError("vendor/orders/shape-row", rowError, {
          orderId: order?.id,
          vendorId,
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
    logPrismaError("vendor/orders", error, {
      vendorId,
      requestedStatus,
    });
    return res.status(500).json({
      error: "Failed to fetch vendor orders",
      code: "VENDOR_ORDERS_FETCH_FAILED",
    });
  }
}
