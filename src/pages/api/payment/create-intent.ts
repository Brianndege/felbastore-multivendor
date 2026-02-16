import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, {});

  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  try {
    // Get cart items and calculate total
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: true
      }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Calculate total amount
    let subtotal = 0;
    cartItems.forEach(item => {
      const price = typeof item.product.price === 'number'
        ? item.product.price
        : parseFloat(item.product.price.toString());
      subtotal += price * item.quantity;
    });

    const taxAmount = subtotal * 0.1; // 10% tax
    const totalAmount = subtotal + taxAmount;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: "usd",
      metadata: {
        userId,
        itemCount: cartItems.length.toString(),
      },
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      amount: totalAmount,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
