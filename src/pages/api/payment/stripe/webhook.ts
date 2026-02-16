import { NextApiRequest, NextApiResponse } from "next";
import { buffer } from "micro";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

// Disable body parsing, need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf.toString(),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error(`[Stripe Webhook] Error verifying webhook signature: ${err instanceof Error ? err.message : err}`);
    return res.status(400).json({ error: "Invalid signature" });
  }

  console.log(`[Stripe Webhook] Event received: ${event.type}`);

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handleSuccessfulPayment(paymentIntent);
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handleFailedPayment(paymentIntent);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing event: ${error instanceof Error ? error.message : error}`);
    // Return 200 to Stripe to acknowledge we received the event
    // even though we had an error processing it
    return res.status(200).json({ received: true, error: "Processing error" });
  }
}

async function handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
  const paymentId = paymentIntent.id;
  console.log(`[Stripe Webhook] Processing successful payment ${paymentId}`);

  // Find the order with this payment ID
  const order = await prisma.order.findFirst({
    where: { paymentIntentId: paymentId },
  });

  if (!order) {
    console.warn(`[Stripe Webhook] No order found for payment ${paymentId}`);
    return;
  }

  // Check if order is already paid to avoid duplicate processing
  if (order.paymentStatus === "paid") {
    console.log(`[Stripe Webhook] Order ${order.id} already marked as paid, skipping`);
    return;
  }

  // Use a transaction for all related updates
  await prisma.$transaction(async (tx) => {
    // Update order status
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "paid",
        status: "confirmed",
      },
    });

    // Get order items to update inventory
    const orderItems = await tx.orderItem.findMany({
      where: { orderId: order.id },
      include: { product: true, vendor: true }
    });

    // Update product inventory and sales count
    for (const item of orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          inventory: {
            decrement: item.quantity
          },
          soldCount: {
            increment: item.quantity
          }
        }
      });

      // Check for low inventory and create alert if needed
      const product = item.product;
      if (product.inventory - item.quantity <= product.lowStockThreshold) {
        await tx.inventoryAlert.create({
          data: {
            vendorId: item.vendorId,
            productId: item.productId,
            type: product.inventory - item.quantity <= 0 ? "out_of_stock" : "low_stock",
            threshold: product.lowStockThreshold,
            currentStock: product.inventory - item.quantity,
            message: `Product "${product.name}" is ${product.inventory - item.quantity <= 0 ? 'out of stock' : 'running low'}.`,
          }
        });
      }

      // Create notification for vendor
      await tx.notification.create({
        data: {
          vendorId: item.vendorId,
          type: "order",
          title: "New Order Received",
          message: `You have received a new order for ${item.quantity}x ${item.productName}`,
          data: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            productId: item.productId,
            quantity: item.quantity
          })
        }
      });
    }

    // Create notification for user
    await tx.notification.create({
      data: {
        userId: order.userId,
        type: "order",
        title: "Order Confirmed",
        message: `Your order #${order.orderNumber} has been confirmed and is being processed.`,
        data: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber
        })
      }
    });
  });

  console.log(`[Stripe Webhook] Successfully processed payment for order ${order.id}`);
}

async function handleFailedPayment(paymentIntent: Stripe.PaymentIntent) {
  const paymentId = paymentIntent.id;
  console.log(`[Stripe Webhook] Processing failed payment ${paymentId}`);

  // Find the order with this payment ID
  const order = await prisma.order.findFirst({
    where: { paymentIntentId: paymentId },
  });

  if (!order) {
    console.warn(`[Stripe Webhook] No order found for payment ${paymentId}`);
    return;
  }

  // Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "failed",
    },
  });

  // Create notification for user about failed payment
  await prisma.notification.create({
    data: {
      userId: order.userId,
      type: "order",
      title: "Payment Failed",
      message: `Your payment for order #${order.orderNumber} has failed. Please try again.`,
      priority: "high",
      data: JSON.stringify({
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: paymentIntent.last_payment_error?.message || "Unknown error"
      })
    }
  });

  console.log(`[Stripe Webhook] Payment failed for order ${order.id}`);
}
