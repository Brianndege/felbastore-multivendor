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

  const userId = session.user.id;

  try {
    if (req.method === "GET") {
      const cartItems = await prisma.cartItem.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              vendor: {
                select: { name: true, storeName: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(cartItems);
    }

    if (req.method === "POST") {
      const { productId, quantity = 1 } = req.body;

      if (!productId) {
        return res.status(400).json({ error: "Product ID is required" });
      }

      const parsedQty = parseInt(quantity);

      if (isNaN(parsedQty) || parsedQty < 1) {
        return res.status(400).json({ error: "Invalid quantity" });
      }

      const product = await prisma.product.findFirst({
        where: { id: productId, status: "active" },
      });

      if (!product) {
        return res
          .status(404)
          .json({ error: "Product not found or unavailable" });
      }

      const existingCartItem = await prisma.cartItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      });

      let cartItem;

      if (existingCartItem) {
        cartItem = await prisma.cartItem.update({
          where: { id: existingCartItem.id },
          data: { quantity: existingCartItem.quantity + parsedQty },
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
      } else {
        cartItem = await prisma.cartItem.create({
          data: {
            userId,
            productId,
            quantity: parsedQty,
          },
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
      }

      return res.status(200).json(cartItem);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Cart API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
