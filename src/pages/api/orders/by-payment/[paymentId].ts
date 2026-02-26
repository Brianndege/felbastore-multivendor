import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { paymentId } = req.query;

  if (!paymentId || typeof paymentId !== "string") {
    return res.status(400).json({ error: "Payment ID is required" });
  }

  try {
    // Find order by payment intent ID
    const order = await prisma.order.findFirst({
      where: { paymentIntentId: paymentId },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if the order belongs to the current user
    if (order.userId !== session.user.id && session.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(200).json({ orderId: order.id, orderNumber: order.orderNumber });
  } catch (error) {
    console.error("Error fetching order by payment ID:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}
