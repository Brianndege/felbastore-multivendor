import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { CheckoutValidationError, evaluateCheckoutEligibility } from "@/lib/checkout-eligibility";
import { enqueueOutboxEvent } from "@/lib/outbox";
import { formatCurrency } from "@/lib/currency";
import { sendOrderCreatedEmailToUser, sendOrderCreatedEmailToVendor } from "@/lib/email";

const VENDOR_CONFIRMATION_SLA_HOURS = 6;

const AddressSchema = z.object({
  address: z.string().optional(),
  city: z.string().min(1),
  country: z.string().min(1),
  lat: z.union([z.number(), z.string()]).optional(),
  lng: z.union([z.number(), z.string()]).optional(),
});

const CreateOrderBodySchema = z.object({
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema,
  paymentMethod: z.string().min(1),
  selectedZoneIds: z.record(z.any()).optional(),
});

type CreatedOrderWithItems = Prisma.OrderGetPayload<{
  include: {
    orderItems: {
      include: {
        product: true;
        vendor: true;
      };
    };
  };
}>;

function logPrismaError(context: string, error: unknown, extra?: Record<string, unknown>) {
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError) {
    console.error(`[${context}] Prisma error`, {
      ...extra,
      name: error.name,
      message: error.message,
      code: (error as Prisma.PrismaClientKnownRequestError).code,
      meta: (error as Prisma.PrismaClientKnownRequestError).meta,
      clientVersion: error.clientVersion,
      stack: error.stack,
    });
    return;
  }

  if (error instanceof Error) {
    console.error(`[${context}] Error`, {
      ...extra,
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  console.error(`[${context}] Unknown error`, {
    ...extra,
    error,
  });
}

function logDeepError(context: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(`[${context}] Deep error context`, extra || {});
  console.dir(error, { depth: null });
}

function normalizePaymentMethodToCode(method: string): string {
  const normalized = method.toLowerCase();

  if (normalized === "pod" || normalized === "pay_on_delivery") return "PAY_ON_DELIVERY";
  if (normalized === "stripe" || normalized === "card") return "CARD";
  if (normalized === "mpesa") return "MPESA";
  if (normalized === "bank_transfer") return "BANK_TRANSFER";
  if (normalized === "wallet") return "WALLET";

  return "";
}

function toOptionalNumber(input: unknown): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === "string") {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

async function runPostOrderSideEffects(input: {
  order: CreatedOrderWithItems;
  userId: string;
  uniqueVendorIds: string[];
  normalizedPaymentMethod: string;
}) {
  const { order, userId, uniqueVendorIds, normalizedPaymentMethod } = input;

  const notificationWrites = [
    prisma.notification.create({
      data: {
        userId,
        type: "order",
        title: "Order Placed - Waiting for Vendor Confirmation",
        message: `Your order #${order.orderNumber} has been placed and is pending vendor confirmation.`,
        data: JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber }),
      },
    }),
    ...uniqueVendorIds.map((vendorId) => {
      const vendorLineItems = order.orderItems.filter((item) => item.vendorId === vendorId);
      const lineItemCount = vendorLineItems.reduce((sum, item) => sum + item.quantity, 0);

      return prisma.notification.create({
        data: {
          vendorId,
          type: "order",
          title: "New Pending Order",
          message: `Order #${order.orderNumber} includes ${lineItemCount} item(s) for your store and needs confirmation.`,
          data: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            itemCount: lineItemCount,
          }),
        },
      });
    }),
  ];

  const sideEffectTasks: Array<Promise<unknown>> = [
    Promise.all(notificationWrites),
    enqueueOutboxEvent({
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
    }),
  ];

  const userRecordPromise = prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const vendorsPromise = prisma.vendor.findMany({
    where: { id: { in: uniqueVendorIds } },
    select: { id: true, email: true, storeName: true },
  });

  const [userRecord, vendors] = await Promise.all([userRecordPromise, vendorsPromise]);

  if (userRecord?.email) {
    sideEffectTasks.push(
      sendOrderCreatedEmailToUser({
        email: userRecord.email,
        customerName: userRecord.name || undefined,
        orderNumber: order.orderNumber,
        amountLabel: formatCurrency(Number(order.totalAmount), order.orderItems[0]?.product?.currency || "KES"),
      })
    );
  }

  sideEffectTasks.push(
    Promise.all(
      vendors.map((vendor) => {
        const lineItems = order.orderItems.filter((item) => item.vendorId === vendor.id);
        const itemSummary = lineItems.map((item) => `${item.quantity}x ${item.productName}`).join(", ");

        return sendOrderCreatedEmailToVendor({
          email: vendor.email,
          storeName: vendor.storeName,
          orderNumber: order.orderNumber,
          itemSummary,
        });
      })
    )
  );

  const sideEffects = await Promise.allSettled(sideEffectTasks);
  const failedSideEffects = sideEffects.filter((result) => result.status === "rejected") as PromiseRejectedResult[];

  if (failedSideEffects.length > 0) {
    console.error("[orders/create] Post-order side effects failed", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      failedCount: failedSideEffects.length,
      reasons: failedSideEffects.map((entry) =>
        entry.reason instanceof Error
          ? { message: entry.reason.message, stack: entry.reason.stack }
          : { reason: entry.reason }
      ),
    });
  }
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
  const parsedBody = CreateOrderBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Invalid request payload",
      code: "INVALID_ORDER_PAYLOAD",
      details: parsedBody.error.issues,
    });
  }

  const { shippingAddress, billingAddress, paymentMethod, selectedZoneIds } = parsedBody.data;
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
        lat: toOptionalNumber(shippingAddress?.lat),
        lng: toOptionalNumber(shippingAddress?.lng),
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

    // Calculate totals with Decimal arithmetic and validate inventory before opening a transaction.
    let subtotal = new Prisma.Decimal(0);
    const orderItems = cartItems.map(item => {
      const unitPriceDecimal = new Prisma.Decimal(item.product.price?.toString() || "0");
      const unitPriceNumber = Number(unitPriceDecimal);

      if (!Number.isFinite(unitPriceNumber) || unitPriceNumber < 0) {
        throw new Error(`INVALID_PRODUCT_PRICE:${item.product.id}`);
      }
      if (!item.product.vendorId) {
        throw new Error(`MISSING_PRODUCT_VENDOR:${item.product.id}`);
      }
      if (item.product.vendor && item.product.vendor.id !== item.product.vendorId) {
        throw new Error(`VENDOR_PRODUCT_RELATION_MISMATCH:${item.product.id}`);
      }
      if (item.product.inventory < item.quantity) {
        throw new Error(`INSUFFICIENT_INVENTORY:${item.product.id}`);
      }

      subtotal = subtotal.plus(unitPriceDecimal.mul(item.quantity));

      return {
        productId: item.product.id,
        vendorId: item.product.vendorId,
        quantity: item.quantity,
        price: unitPriceDecimal,
        productName: item.product.name,
        productImage: item.product.images?.[0] || null
      };
    });

    const shippingAmountDecimal = new Prisma.Decimal(0);
    const taxAmountDecimal = subtotal.mul(new Prisma.Decimal("0.1"));
    const totalAmountDecimal = subtotal.plus(shippingAmountDecimal).plus(taxAmountDecimal);

    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const decimalTotalAmount = totalAmountDecimal.toDecimalPlaces(2);
    const decimalShippingAmount = shippingAmountDecimal.toDecimalPlaces(2);
    const decimalTaxAmount = taxAmountDecimal.toDecimalPlaces(2);
    const decimalDiscountAmount = new Prisma.Decimal(0);

    const uniqueVendorIds = Array.from(new Set(orderItems.map((item) => item.vendorId)));
    const primaryVendorId = uniqueVendorIds.length === 1 ? uniqueVendorIds[0] : null;

    const now = new Date();
    const confirmationDueAt = new Date(now.getTime() + VENDOR_CONFIRMATION_SLA_HOURS * 60 * 60 * 1000);

    const order = await prisma.$transaction(async (tx) => {
      for (const item of orderItems) {
        const inventoryUpdated = await tx.product.updateMany({
          where: {
            id: item.productId,
            inventory: { gte: item.quantity },
          },
          data: {
            inventory: { decrement: item.quantity },
            soldCount: { increment: item.quantity },
          },
        });

        if (inventoryUpdated.count === 0) {
          throw new Error(`INVENTORY_UPDATE_FAILED:${item.productId}`);
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          customerId: userId,
          vendorId: primaryVendorId,
          totalAmount: decimalTotalAmount,
          shippingAmount: decimalShippingAmount,
          taxAmount: decimalTaxAmount,
          discountAmount: decimalDiscountAmount,
          paymentMethod: normalizedPaymentMethod,
          paymentStatus: isPodOrder ? "approved" : "pending",
          shippingAddress: JSON.stringify(shippingAddress),
          billingAddress: JSON.stringify(billingAddress),
          orderItems: {
            create: orderItems,
          },
        },
        include: {
          orderItems: {
            include: {
              product: true,
              vendor: true,
            },
          },
        },
      });

      await tx.cartItem.deleteMany({
        where: { userId },
      });

      await tx.orderVendorFulfillment.createMany({
        data: uniqueVendorIds.map((vendorId) => ({
          orderId: createdOrder.id,
          vendorId,
          orderStatus: "PENDING",
          shippingStatus: "PENDING",
          confirmationDueAt,
        })),
        skipDuplicates: true,
      });

      await tx.orderStatusAudit.createMany({
        data: uniqueVendorIds.map((vendorId) => ({
          orderId: createdOrder.id,
          vendorId,
          toStatus: "PENDING",
          actorRole: "system",
          actorId: userId,
          note: "Order created and awaiting vendor acknowledgement",
        })),
      });

      return createdOrder;
    }, {
      maxWait: 5000,
      timeout: 10000,
    });

    await runPostOrderSideEffects({
      order,
      userId,
      uniqueVendorIds,
      normalizedPaymentMethod,
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

    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("INSUFFICIENT_INVENTORY:") || message.startsWith("INVENTORY_UPDATE_FAILED:")) {
      return res.status(409).json({
        error: "One or more items are out of stock",
        code: "INSUFFICIENT_INVENTORY",
      });
    }

    if (message.startsWith("MISSING_PRODUCT_VENDOR:")) {
      return res.status(400).json({
        error: "Cart contains products without a vendor reference",
        code: "INVALID_CART_PRODUCT_VENDOR",
      });
    }

    if (message.startsWith("VENDOR_PRODUCT_RELATION_MISMATCH:")) {
      return res.status(409).json({
        error: "Cart contains a product with inconsistent vendor relation. Please refresh cart and retry.",
        code: "VENDOR_PRODUCT_RELATION_MISMATCH",
      });
    }

    if (message.startsWith("INVALID_PRODUCT_PRICE:")) {
      return res.status(400).json({
        error: "Cart contains products with invalid pricing",
        code: "INVALID_CART_PRODUCT_PRICE",
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json({
          error: "Order already exists. Please refresh and try again.",
          code: "ORDER_CONFLICT",
        });
      }

      if (error.code === "P2003") {
        return res.status(409).json({
          error: "Cart contains stale product or vendor references. Please refresh cart and retry.",
          code: "STALE_CART_RELATION",
        });
      }

      if (error.code === "P2024") {
        return res.status(503).json({
          error: "Order service is temporarily busy. Please retry in a moment.",
          code: "DB_POOL_TIMEOUT",
        });
      }

      if (error.code === "P2034") {
        return res.status(503).json({
          error: "Order transaction conflict detected. Please retry checkout.",
          code: "DB_TRANSACTION_CONFLICT",
        });
      }
    }

    logPrismaError("orders/create", error, {
      userId,
      paymentMethod: normalizedPaymentMethod,
      hasShippingAddress: Boolean(shippingAddress),
      hasBillingAddress: Boolean(billingAddress),
    });
    logDeepError("orders/create", error, {
      userId,
      paymentMethod: normalizedPaymentMethod,
      selectedZoneIdsType: typeof selectedZoneIds,
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
