import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  const session = await getServerSession(req, res, {});
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

    // Parse shipping and billing addresses
    let shippingAddress;
    let billingAddress;

    try {
      shippingAddress = JSON.parse(order.shippingAddress);
    } catch (e) {
      shippingAddress = { error: "Invalid shipping address format" };
    }

    try {
      billingAddress = JSON.parse(order.billingAddress);
    } catch (e) {
      billingAddress = { error: "Invalid billing address format" };
    }

    // Format order data
    const formattedOrder = {
      ...order,
      shippingAddress,
      billingAddress,
    };

    return res.status(200).json(formattedOrder);
  } catch (error) {
    console.error("Error retrieving order:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
