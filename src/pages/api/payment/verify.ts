import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/payments";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { enqueueOutboxEvent } from "@/lib/outbox";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  // We allow both authenticated and webhook requests
  const session = await getServerSession(req, res, authOptions);
  const isWebhook = req.headers['x-webhook-source'] === 'payment-provider';

  // For user requests, verify authentication
  if (!isWebhook && (!session || session.user.role !== "user")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { paymentId, paymentMethod } = req.body;

  if (!paymentId || !paymentMethod) {
    return res.status(400).json({ error: "Payment ID and payment method are required" });
  }

  try {
    // Verify the payment with the provider
    const paymentResult = await verifyPayment(paymentId, paymentMethod);
    logger.info(`[Payment] Verification result for ${paymentId}:`, paymentResult.status);

    if (paymentResult.success) {
      // Find the order with this payment ID
      const order = await prisma.order.findFirst({
        where: { paymentIntentId: paymentId },
      });

      if (order) {
        if (paymentResult.status === "SUCCESS") {
          // Idempotent gate: exactly one process may transition to paid and mutate inventory.
          const paidUpdate = await prisma.order.updateMany({
            where: { id: order.id, paymentStatus: { notIn: ["paid", "approved"] } },
            data: {
              paymentStatus: "paid",
              status: "confirmed",
            },
          });

          if (paidUpdate.count > 0) {
            // Transaction for atomic updates
            await prisma.$transaction(async (tx) => {
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
          }
        } else if (paymentResult.status === "FAILED") {
          await prisma.order.updateMany({
            where: { id: order.id, paymentStatus: { notIn: ["paid", "approved"] } },
            data: {
              paymentStatus: "failed",
            },
          });
        } else {
          await prisma.order.updateMany({
            where: { id: order.id, paymentStatus: { notIn: ["paid", "approved"] } },
            data: {
              paymentStatus: "pending",
            },
          });
        }

        await enqueueOutboxEvent({
          topic: paymentResult.status === "SUCCESS" ? "payment.succeeded" : paymentResult.status === "FAILED" ? "payment.failed" : "payment.pending",
          entityType: "order",
          entityId: order.id,
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            paymentId,
            paymentMethod,
            status: paymentResult.status,
            verifiedAt: new Date().toISOString(),
          },
        });

        return res.status(200).json({
          success: true,
          status: paymentResult.status,
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentStatus: paymentResult.status === "SUCCESS" ? "paid" :
                        paymentResult.status === "FAILED" ? "failed" : "pending"
        });
      } else {
        logger.warn(`[Payment] No order found for payment ID ${paymentId}`);
        return res.status(404).json({
          success: false,
          error: "Order not found for this payment"
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        status: paymentResult.status,
        message: paymentResult.message
      });
    }
  } catch (error) {
    logger.error("[Payment] Verification error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}
