import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { deriveAggregateOrderStatus } from "@/lib/order-lifecycle";

function safeLowercase(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  return value.toLowerCase();
}

function isLifecycleSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("ordervendorfulfillment") ||
    message.includes("orderstatusaudit") ||
    message.includes("the table") ||
    message.includes("does not exist") ||
    message.includes("unknown field")
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  switch (req.method) {
    case "GET":
      return getOrder(req, res, id, session);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

async function getOrder(
  req: NextApiRequest,
  res: NextApiResponse,
  orderId: string,
  session: any
) {
  const formatOrderResponse = (order: any, shippingAddress: any, billingAddress: any) => ({
    ...order,
    status: Array.isArray(order.vendorFulfillments)
      ? deriveAggregateOrderStatus(
          order.vendorFulfillments
            .map((entry: any) => safeLowercase(entry.orderStatus, ""))
            .filter(Boolean)
        )
      : safeLowercase(order.status, "pending"),
    shippingAddress,
    billingAddress,
    vendorFulfillments: Array.isArray(order.vendorFulfillments)
      ? order.vendorFulfillments.map((entry: any) => ({
          id: entry.id,
          vendorId: entry.vendorId,
          vendorName: entry.vendor.storeName || entry.vendor.name,
          vendorEmail: entry.vendor.email,
          orderStatus: safeLowercase(entry.orderStatus, "pending"),
          shippingStatus: safeLowercase(entry.shippingStatus, "pending"),
          trackingNumber: entry.trackingNumber,
          shippingProvider: entry.shippingProvider,
          trackingUrl: entry.trackingUrl,
          estimatedDeliveryAt: entry.estimatedDeliveryAt,
          confirmationDueAt: entry.confirmationDueAt,
          acknowledgedAt: entry.acknowledgedAt,
          confirmedAt: entry.confirmedAt,
          processingAt: entry.processingAt,
          shippedAt: entry.shippedAt,
          inTransitAt: entry.inTransitAt,
          deliveredAt: entry.deliveredAt,
          completedAt: entry.completedAt,
          cancelledAt: entry.cancelledAt,
          refundedAt: entry.refundedAt,
          disputeOpenedAt: entry.disputeOpenedAt,
          disputeResolvedAt: entry.disputeResolvedAt,
          disputeReason: entry.disputeReason,
        }))
      : [],
    timeline: Array.isArray(order.statusAudits)
      ? order.statusAudits.map((entry: any) => ({
          id: entry.id,
          vendorId: entry.vendorId,
          fromStatus: safeLowercase(entry.fromStatus, "") || null,
          toStatus: safeLowercase(entry.toStatus, "pending"),
          actorRole: entry.actorRole,
          actorId: entry.actorId,
          note: entry.note,
          metadata: entry.metadata,
          createdAt: entry.createdAt,
        }))
      : [],
  });

  const parseAddresses = (order: any) => {
    let shippingAddress;
    let billingAddress;

    try {
      shippingAddress = JSON.parse(order.shippingAddress);
    } catch {
      shippingAddress = { error: "Invalid shipping address format" };
    }

    try {
      billingAddress = JSON.parse(order.billingAddress);
    } catch {
      billingAddress = { error: "Invalid billing address format" };
    }

    return { shippingAddress, billingAddress };
  };

  try {
    // Find the order with its items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                currency: true,
                vendor: {
                  select: {
                    id: true,
                    name: true,
                    storeName: true,
                  },
                },
              },
            },
          },
        },
        vendorFulfillments: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                storeName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        statusAudits: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if user is authorized to access this order
    const isAuthorized =
      order.userId === session.user.id ||
      session.user.role === "admin" ||
      (session.user.role === "vendor" &&
        order.orderItems.some(item => item.vendorId === session.user.id));

    if (!isAuthorized) {
      return res.status(403).json({ error: "Not authorized to view this order" });
    }

    const { shippingAddress, billingAddress } = parseAddresses(order);
    const formattedOrder = formatOrderResponse(order, shippingAddress, billingAddress);

    return res.status(200).json(formattedOrder);
  } catch (error) {
    if (isLifecycleSchemaError(error)) {
      try {
        const legacyOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            orderItems: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: true,
                    currency: true,
                    vendor: {
                      select: {
                        id: true,
                        name: true,
                        storeName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!legacyOrder) {
          return res.status(404).json({ error: "Order not found" });
        }

        const isAuthorized =
          legacyOrder.userId === session.user.id ||
          session.user.role === "admin" ||
          (session.user.role === "vendor" &&
            legacyOrder.orderItems.some((item: any) => item.vendorId === session.user.id));

        if (!isAuthorized) {
          return res.status(403).json({ error: "Not authorized to view this order" });
        }

        const { shippingAddress, billingAddress } = parseAddresses(legacyOrder);
        return res.status(200).json(formatOrderResponse(legacyOrder, shippingAddress, billingAddress));
      } catch (legacyError) {
        console.error("Error retrieving order (legacy fallback):", legacyError);
      }
    }

    console.error("Error retrieving order:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
