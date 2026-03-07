import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { deriveAggregateOrderStatus } from "@/lib/order-lifecycle";

const prismaUnsafe = prisma as any;

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
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const orders = await prismaUnsafe.order.findMany({
        where: { userId: session.user.id },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  currency: true,
                  vendor: {
                    select: { name: true, storeName: true },
                  },
                },
              }
            }
          },
          vendorFulfillments: {
            include: {
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
        orderBy: { createdAt: "desc" }
      });

      return res.status(200).json(
        orders.map((order: any) => ({
          ...order,
          status: deriveAggregateOrderStatus(
            order.vendorFulfillments
              .map((entry: any) => safeLowercase(entry.orderStatus, ""))
              .filter(Boolean)
          ),
          vendorFulfillments: order.vendorFulfillments.map((entry: any) => ({
            id: entry.id,
            vendorId: entry.vendorId,
            vendorName: entry.vendor.storeName || entry.vendor.name,
            orderStatus: safeLowercase(entry.orderStatus, "pending"),
            shippingStatus: safeLowercase(entry.shippingStatus, "pending"),
            trackingNumber: entry.trackingNumber,
            shippingProvider: entry.shippingProvider,
            trackingUrl: entry.trackingUrl,
            estimatedDeliveryAt: entry.estimatedDeliveryAt,
          })),
        }))
      );
    } catch (error) {
      if (isLifecycleSchemaError(error)) {
        try {
          const legacyOrders = await prismaUnsafe.order.findMany({
            where: { userId: session.user.id },
            include: {
              orderItems: {
                include: {
                  product: {
                    select: {
                      currency: true,
                      vendor: {
                        select: { name: true, storeName: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          });

          return res.status(200).json(
            legacyOrders.map((order: any) => ({
              ...order,
              vendorFulfillments: [],
              status: String(order.status || "pending").toLowerCase(),
            }))
          );
        } catch (legacyError) {
          console.error("Error fetching orders (legacy fallback):", legacyError);
        }
      }

      console.error("Error fetching orders:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
