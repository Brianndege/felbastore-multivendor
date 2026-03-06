import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { CheckoutValidationError, evaluateCheckoutEligibility } from "@/lib/checkout-eligibility";

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
  const body = req.body || {};
  const address = body.address || {};

  try {
    const eligibility = await evaluateCheckoutEligibility({
      userId,
      address: {
        city: address.city,
        country: address.country,
        lat: address.lat,
        lng: address.lng,
      },
      selectedZoneIds: typeof body.selectedZoneIds === "object" && body.selectedZoneIds !== null ? body.selectedZoneIds : undefined,
    });

    if (!eligibility.eligible) {
      return res.status(400).json({
        error: "Delivery is unavailable for one or more vendors in this cart",
        code: "COVERAGE_OUT_OF_RANGE",
        details: { vendorCoverage: eligibility.vendorCoverage },
      });
    }

    const hasCardOption = eligibility.paymentOptions.some((option) => option.code === "CARD");
    if (!hasCardOption) {
      return res.status(400).json({
        error: "Card payment is not allowed for this cart",
        code: "PAYMENT_METHOD_NOT_ALLOWED",
      });
    }

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
        : Number(item.product.price);
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
    if (error instanceof CheckoutValidationError) {
      return res.status(400).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    console.error("Error creating payment intent:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
