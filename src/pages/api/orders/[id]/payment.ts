import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") return res.status(405).end();

  const session = await getServerSession(req, res, {});

  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  const { paymentIntentId, paymentStatus } = req.body;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  try {
    // Verify order belongs to user
    const order = await prisma.order.findFirst({
      where: { id, userId: session.user.id }
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Update payment status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        paymentIntentId,
        paymentStatus,
        status: paymentStatus === "paid" ? "confirmed" : order.status,
      },
    });

    return res.status(200).json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
