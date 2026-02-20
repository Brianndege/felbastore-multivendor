import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // adjust path if needed
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  const userId = session.user.id;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid cart item ID" });
  }

  try {
    const cartItem = await prisma.cartItem.findFirst({
      where: { id, userId },
    });

    if (!cartItem) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    if (req.method === "PUT") {
      const { quantity } = req.body;
      const parsedQty = parseInt(quantity);

      if (isNaN(parsedQty) || parsedQty < 1) {
        return res.status(400).json({ error: "Invalid quantity" });
      }

      const updatedCartItem = await prisma.cartItem.update({
        where: { id },
        data: { quantity: parsedQty },
        include: {
          product: {
            include: {
              vendor: {
                select: { name: true, storeName: true },
              },
            },
          },
        },
      });

      return res.status(200).json(updatedCartItem);
    }

    if (req.method === "DELETE") {
      await prisma.cartItem.delete({
        where: { id },
      });

      return res.status(200).json({ message: "Item removed from cart" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Cart item API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
