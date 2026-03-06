import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  const { paymentIntentId, paymentStatus } = req.body;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  if (typeof paymentStatus !== "undefined") {
    return res.status(400).json({ error: "paymentStatus cannot be set by client" });
  }

  if (!paymentIntentId || typeof paymentIntentId !== "string") {
    return res.status(400).json({ error: "paymentIntentId is required" });
  }

  try {
    // Verify order belongs to user
    const order = await prisma.order.findFirst({
      where: { id, userId: session.user.id }
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.paymentStatus === "paid" || order.paymentStatus === "approved") {
      return res.status(400).json({ error: "Order is already paid" });
    }

    // Only attach payment reference here. Payment state is set by verified provider callbacks.
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        paymentIntentId,
      },
    });

    return res.status(200).json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
