import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, {});

  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  const userId = session.user.id;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid cart item ID" });
  }

  // Verify cart item belongs to the user
  const cartItem = await prisma.cartItem.findFirst({
    where: { id, userId }
  });

  if (!cartItem) {
    return res.status(404).json({ error: "Cart item not found" });
  }

  if (req.method === "PUT") {
    try {
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return res.status(400).json({ error: "Invalid quantity" });
      }

      const updatedCartItem = await prisma.cartItem.update({
        where: { id },
        data: { quantity: parseInt(quantity) },
        include: {
          product: {
            include: {
              vendor: {
                select: { name: true, storeName: true }
              }
            }
          }
        }
      });

      return res.status(200).json(updatedCartItem);
    } catch (error) {
      console.error("Error updating cart item:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "DELETE") {
    try {
      await prisma.cartItem.delete({
        where: { id }
      });

      return res.status(200).json({ message: "Item removed from cart" });
    } catch (error) {
      console.error("Error removing cart item:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
