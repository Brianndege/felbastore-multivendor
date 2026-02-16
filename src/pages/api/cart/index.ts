import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, {});

  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  if (req.method === "GET") {
    try {
      const cartItems = await prisma.cartItem.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              vendor: {
                select: { name: true, storeName: true }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      return res.status(200).json(cartItems);
    } catch (error) {
      console.error("Error fetching cart:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    try {
      const { productId, quantity = 1 } = req.body;

      if (!productId) {
        return res.status(400).json({ error: "Product ID is required" });
      }

      // Check if product exists and is active
      const product = await prisma.product.findFirst({
        where: { id: productId, status: "active" }
      });

      if (!product) {
        return res.status(404).json({ error: "Product not found or unavailable" });
      }

      // Check if item already exists in cart
      const existingCartItem = await prisma.cartItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId
          }
        }
      });

      let cartItem;

      if (existingCartItem) {
        // Update quantity
        cartItem = await prisma.cartItem.update({
          where: { id: existingCartItem.id },
          data: { quantity: existingCartItem.quantity + parseInt(quantity) },
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
      } else {
        // Create new cart item
        cartItem = await prisma.cartItem.create({
          data: {
            userId,
            productId,
            quantity: parseInt(quantity)
          },
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
      }

      return res.status(200).json(cartItem);
    } catch (error) {
      console.error("Error adding to cart:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
