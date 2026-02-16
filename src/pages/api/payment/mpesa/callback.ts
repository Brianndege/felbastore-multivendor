import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { MPesaPaymentProvider } from "@/lib/payments/mpesa-provider";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  console.log("[MPesa Callback] Received callback");

  // This should be secured with webhook signing verification in production
  try {
    const callbackData = req.body;
    console.log("[MPesa Callback] Data received:", JSON.stringify(callbackData));

    // Process the callback with the M-Pesa provider
    const paymentResult = await MPesaPaymentProvider.handleCallback(callbackData);

    if (!paymentResult.paymentId) {
      console.error("[MPesa Callback] No payment ID in response");
      return res.status(400).json({ error: "Invalid callback data" });
    }

    // Find the order with this payment ID
    const order = await prisma.order.findFirst({
      where: { paymentIntentId: paymentResult.paymentId },
    });

    if (!order) {
      console.warn(`[MPesa Callback] No order found for payment ID ${paymentResult.paymentId}`);
      return res.status(200).json({ received: true, status: "no-order-found" });
    }

    // Update order status based on payment result
    if (paymentResult.success) {
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

      console.log(`[MPesa Callback] Successfully processed payment for order ${order.id}`);
    } else {
      // Payment failed
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
            reason: paymentResult.message
          })
        }
      });

      console.log(`[MPesa Callback] Payment failed for order ${order.id}: ${paymentResult.message}`);
    }

    // Always return 200 OK to MPesa so they don't retry
    return res.status(200).json({ received: true, success: paymentResult.success });
  } catch (error) {
    console.error("[MPesa Callback] Error processing callback:", error);

    // Always return 200 to MPesa (even for errors) to prevent retries
    return res.status(200).json({
      received: true,
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}
