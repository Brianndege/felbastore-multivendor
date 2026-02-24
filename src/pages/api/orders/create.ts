import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;
  const { shippingAddress, billingAddress, paymentMethod } = req.body;

  if (!shippingAddress || !billingAddress) {
    return res.status(400).json({ error: "Shipping and billing addresses are required" });
  }

  try {
    // Get cart items
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            vendor: true
          }
        }
      }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = cartItems.map(item => {
      const price = typeof item.product.price === 'number'
        ? item.product.price
        : parseFloat(item.product.price.toString());
      subtotal += price * item.quantity;

      return {
        productId: item.product.id,
        vendorId: item.product.vendorId,
        quantity: item.quantity,
        price: price,
        productName: item.product.name,
        productImage: item.product.images[0] || null
      };
    });

    const shippingAmount = 0; // Free shipping
    const taxAmount = subtotal * 0.1; // 10% tax
    const totalAmount = subtotal + shippingAmount + taxAmount;

    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Create order and clear cart atomically
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId,
          totalAmount,
          shippingAmount,
          taxAmount,
          discountAmount: 0,
          paymentMethod: paymentMethod || "pending",
          shippingAddress: JSON.stringify(shippingAddress),
          billingAddress: JSON.stringify(billingAddress),
          orderItems: {
            create: orderItems
          }
        },
        include: {
          orderItems: {
            include: {
              product: true,
              vendor: true
            }
          }
        }
      });

      // Clear cart after successful order creation
      await tx.cartItem.deleteMany({
        where: { userId }
      });

      return created;
    });

    return res.status(201).json({
      order,
      message: "Order created successfully"
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
