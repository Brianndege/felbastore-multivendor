import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import {
  processPayment,
  calculateOrderAmount,
  generateIdempotencyKey
} from "@/lib/payments";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify session and authorization
  const session = await getServerSession(req, res, {});
  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;
  const { orderId, paymentMethod, returnUrl } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "Order ID is required" });
  }

  if (!paymentMethod) {
    return res.status(400).json({ error: "Payment method is required" });
  }

  try {
    // Get order and validate it belongs to the current user
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({ error: "Order is already paid" });
    }

    // Recalculate the total to ensure data integrity
    const items = order.orderItems.map(item => ({
      product: {
        price: item.price
      },
      quantity: item.quantity
    }));

    const calculatedAmount = calculateOrderAmount(items, {
      tax: Number(order.taxAmount),
      shipping: Number(order.shippingAmount),
      discount: Number(order.discountAmount)
    });

    // Compare with stored total to ensure integrity
    if (Math.abs(calculatedAmount.total - Number(order.totalAmount)) > 0.01) {
      console.error(
        `[Payment] Total amount mismatch for order ${orderId}: ` +
        `calculated=${calculatedAmount.total}, stored=${order.totalAmount}`
      );
      return res.status(400).json({
        error: "Order total mismatch. Please contact customer support."
      });
    }

    // Get customer information from the user profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate an idempotency key for this payment attempt
    const idempotencyKey = generateIdempotencyKey(orderId, paymentMethod);

    // Process the payment with the selected payment method
    const paymentResult = await processPayment({
      paymentMethod,
      amount: {
        ...calculatedAmount,
        currency: 'USD', // Default currency
      },
      metadata: {
        orderId,
        userId,
        itemCount: order.orderItems.length,
        paymentAttempt: Date.now().toString(),
      },
      customerInfo: {
        name: user.name || undefined,
        email: user.email || undefined,
        phone: user.phone || undefined,
      },
      returnUrl,
      idempotencyKey,
    });

    if (paymentResult.success) {
      // If we have a payment ID, update the order with it
      if (paymentResult.paymentId) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentIntentId: paymentResult.paymentId,
            paymentMethod,
            // Don't update payment status yet as the payment is still in progress
          },
        });
      }

      return res.status(200).json({
        success: true,
        paymentId: paymentResult.paymentId,
        clientSecret: paymentResult.clientSecret,
        redirectUrl: paymentResult.redirectUrl,
        status: paymentResult.status,
        message: paymentResult.message
      });
    } else {
      return res.status(400).json({
        success: false,
        error: paymentResult.message
      });
    }
  } catch (error) {
    console.error("Error creating payment:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}
