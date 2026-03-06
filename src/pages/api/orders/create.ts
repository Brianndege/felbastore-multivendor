import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";
import crypto from "crypto";
import { CheckoutValidationError, evaluateCheckoutEligibility } from "@/lib/checkout-eligibility";
import { enqueueOutboxEvent } from "@/lib/outbox";

function normalizePaymentMethodToCode(method: string): string {
  const normalized = method.toLowerCase();

  if (normalized === "pod" || normalized === "pay_on_delivery") return "PAY_ON_DELIVERY";
  if (normalized === "stripe" || normalized === "card") return "CARD";
  if (normalized === "mpesa") return "MPESA";
  if (normalized === "bank_transfer") return "BANK_TRANSFER";
  if (normalized === "wallet") return "WALLET";

  return "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;
  const { shippingAddress, billingAddress, paymentMethod, selectedZoneIds } = req.body;
  const normalizedPaymentMethod = typeof paymentMethod === "string" ? paymentMethod.toLowerCase() : "pending";
  const isPodOrder = normalizedPaymentMethod === "pod" || normalizedPaymentMethod === "pay_on_delivery";

  if (!shippingAddress || !billingAddress) {
    return res.status(400).json({ error: "Shipping and billing addresses are required" });
  }

  try {
    const eligibility = await evaluateCheckoutEligibility({
      userId,
      address: {
        city: shippingAddress?.city,
        country: shippingAddress?.country,
        lat: shippingAddress?.lat,
        lng: shippingAddress?.lng,
      },
      selectedZoneIds: typeof selectedZoneIds === "object" && selectedZoneIds !== null ? selectedZoneIds : undefined,
    });

    if (!eligibility.eligible) {
      return res.status(400).json({
        error: "Delivery is unavailable for one or more vendors in this cart",
        code: "COVERAGE_OUT_OF_RANGE",
        details: { vendorCoverage: eligibility.vendorCoverage },
      });
    }

    const selectedPaymentCode = normalizePaymentMethodToCode(normalizedPaymentMethod);
    if (!selectedPaymentCode) {
      return res.status(400).json({
        error: "Unsupported payment method",
        code: "UNSUPPORTED_PAYMENT_METHOD",
      });
    }

    const allowedPaymentCodes = new Set(eligibility.paymentOptions.map((option) => option.code));
    if (!allowedPaymentCodes.has(selectedPaymentCode as any)) {
      return res.status(400).json({
        error: "Selected payment method is not allowed for this cart",
        code: "PAYMENT_METHOD_NOT_ALLOWED",
        details: {
          selected: selectedPaymentCode,
          allowed: [...allowedPaymentCodes],
        },
      });
    }

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
        : Number(item.product.price);
      subtotal += price * item.quantity;

      return {
        productId: item.product.id,
        vendorId: item.product.vendorId,
        quantity: item.quantity,
        price: price,
        productName: item.product.name,
        productImage: item.product.images?.[0] || null
      };
    });

    const shippingAmount = 0; // Free shipping
    const taxAmount = subtotal * 0.1; // 10% tax
    const totalAmount = subtotal + shippingAmount + taxAmount;

    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        totalAmount,
        shippingAmount,
        taxAmount,
        discountAmount: 0,
        paymentMethod: normalizedPaymentMethod,
        paymentStatus: isPodOrder ? "approved" : "pending",
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
    await prisma.cartItem.deleteMany({
      where: { userId }
    });

    await enqueueOutboxEvent({
      topic: "order.created",
      entityType: "order",
      entityId: order.id,
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId,
        totalAmount: Number(order.totalAmount),
        paymentMethod: normalizedPaymentMethod,
        createdAt: order.createdAt.toISOString(),
      },
    });

    return res.status(201).json({
      order,
      message: "Order created successfully"
    });
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return res.status(400).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    console.error("Error creating order:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
