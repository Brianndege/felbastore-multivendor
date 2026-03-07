import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { enforceCsrfOrigin } from "@/lib/csrf";

type AssistantRole = "guest" | "user" | "vendor" | "admin";
type AssistantContext = "product" | "checkout" | "vendor-dashboard" | "admin-dashboard" | "order-detail";

type AssistantRequestBody = {
  role?: AssistantRole;
  context?: AssistantContext;
  message?: string;
  metadata?: {
    productName?: string;
    vendorName?: string;
    blockedVendorNames?: string[];
    pendingApprovals?: number;
    unreadModerationCount?: number;
    orderStatus?: string;
    paymentStatus?: string;
    orderNumber?: string;
  };
};

function normalizeRole(input?: string, sessionRole?: string): AssistantRole {
  const fromSession = (sessionRole || "").toLowerCase();
  if (fromSession === "admin" || fromSession === "vendor" || fromSession === "user") {
    return fromSession as AssistantRole;
  }

  const candidate = (input || "").toLowerCase();
  if (candidate === "admin" || candidate === "vendor" || candidate === "user") {
    return candidate as AssistantRole;
  }

  return "guest";
}

function normalizeContext(input?: string): AssistantContext {
  const candidate = (input || "").toLowerCase();
  if (
    candidate === "product" ||
    candidate === "checkout" ||
    candidate === "vendor-dashboard" ||
    candidate === "admin-dashboard" ||
    candidate === "order-detail"
  ) {
    return candidate;
  }

  return "product";
}

function createSuggestions(context: AssistantContext, role: AssistantRole): string[] {
  if (context === "checkout") {
    return [
      "Why is my payment method unavailable?",
      "How do I fix delivery range issues?",
      "What happens after I place the order?",
    ];
  }

  if (context === "order-detail") {
    return [
      "How do I complete payment now?",
      "How can I track this order?",
      "What should I do if delivery is delayed?",
    ];
  }

  if (context === "vendor-dashboard") {
    return [
      "How do I reduce checkout failures?",
      "What order status should I update next?",
      "How do I handle moderation notifications?",
    ];
  }

  if (context === "admin-dashboard") {
    return [
      "How should I prioritize moderation queue?",
      "How do I handle rejected submissions clearly?",
      "What should I monitor in live feed first?",
    ];
  }

  return role === "guest"
    ? ["How do I start checkout?", "How can I compare vendors?", "How do I track an order?"]
    : ["How do I checkout faster?", "How do I track delivery?", "How do I contact support?"];
}

function buildReply(
  message: string,
  context: AssistantContext,
  role: AssistantRole,
  metadata: AssistantRequestBody["metadata"]
): string {
  const normalized = message.toLowerCase();
  const blockedVendors = Array.isArray(metadata?.blockedVendorNames) ? metadata?.blockedVendorNames : [];

  if (context === "checkout") {
    if (normalized.includes("payment")) {
      return "Payment options are filtered to methods approved for the vendors in your cart. If one is missing, re-check eligibility after confirming shipping details and delivery ranges.";
    }

    if (normalized.includes("delivery") || normalized.includes("range") || normalized.includes("blocked")) {
      if (blockedVendors.length > 0) {
        return `Delivery is currently blocked for: ${blockedVendors.join(", ")}. Select an available delivery zone for each blocked vendor, then run eligibility check again.`;
      }
      return "If delivery fails, verify city and country first, then choose an active vendor delivery zone and re-run eligibility.";
    }

    return "Complete shipping details first, then choose one of the allowed payment methods. After successful payment, the order appears in My Orders for tracking.";
  }

  if (context === "order-detail") {
    const orderStatus = (metadata?.orderStatus || "pending").toLowerCase();
    const paymentStatus = (metadata?.paymentStatus || "pending").toLowerCase();

    if (normalized.includes("track") || normalized.includes("delivery") || normalized.includes("ship")) {
      if (orderStatus === "shipped" || orderStatus === "delivered") {
        return "Your order is already in shipping flow. Use the Track Package action to follow delivery progress and confirmation updates.";
      }
      return "Tracking becomes useful once the order is shipped. For now, monitor status changes here and contact support if processing takes too long.";
    }

    if (normalized.includes("pay") || normalized.includes("payment")) {
      if (orderStatus === "pending" && paymentStatus !== "paid") {
        return "This order is still unpaid. Use Complete Payment to finish checkout and trigger vendor fulfillment.";
      }
      return "Payment for this order appears settled. You can keep following order status updates from this page.";
    }

    return "Use this page as the source of truth for payment status, shipping progress, and next actions. If anything looks stalled, contact support with the order number.";
  }

  if (context === "vendor-dashboard") {
    if (normalized.includes("zone") || normalized.includes("delivery") || normalized.includes("checkout")) {
      return "Keep at least one active delivery zone with accurate center and radius. Missing or inactive zones are a common reason for checkout failures.";
    }

    if (normalized.includes("order") || normalized.includes("status")) {
      return "Move orders through status transitions quickly: pending -> processing -> shipped -> delivered. Fast updates reduce support tickets and improve trust.";
    }

    if (normalized.includes("moderation") || normalized.includes("reject")) {
      const unread = typeof metadata?.unreadModerationCount === "number" ? metadata.unreadModerationCount : 0;
      return unread > 0
        ? `You currently have ${unread} unread moderation notifications. Review them first to prevent listing delays.`
        : "No unread moderation items at the moment. Keep product details complete to avoid future rejections.";
    }

    return "Focus on three loops daily: moderation notifications, delivery zone health, and order status progression.";
  }

  if (context === "admin-dashboard") {
    if (normalized.includes("queue") || normalized.includes("moderation") || normalized.includes("approve") || normalized.includes("reject")) {
      const pending = typeof metadata?.pendingApprovals === "number" ? metadata.pendingApprovals : 0;
      return pending > 0
        ? `There are ${pending} pending approvals. Prioritize by risk first, then age. Include clear rejection reasons so vendors can remediate quickly.`
        : "Moderation queue is currently light. Keep monitoring live feed anomalies and payment-method approvals.";
    }

    if (normalized.includes("live") || normalized.includes("monitor") || normalized.includes("alert")) {
      return "Watch for failed-payment spikes, verification backlog growth, and unusual signup bursts. Investigate trend changes before they become incidents.";
    }

    return "For stable operations, combine queue hygiene (fast moderation) with live-feed monitoring and clear vendor-facing rejection reasons.";
  }

  if (context === "product") {
    if (normalized.includes("vendor") || normalized.includes("trust")) {
      return metadata?.vendorName
        ? `${metadata.vendorName} is the current seller. Review rating, delivery expectations, and return policy before checkout.`
        : "Review seller details, delivery expectations, and return policy before checkout.";
    }

    if (normalized.includes("price") || normalized.includes("currency")) {
      return "Pricing is shown in the product currency. Add the item to cart and confirm totals in checkout before placing the order.";
    }

    if (role === "guest") {
      return "You can browse freely, but signing in lets you save cart changes and track order progress after purchase.";
    }

    return "Compare product details, add your preferred quantity, and proceed to checkout when shipping details are ready.";
  }

  return "I can help with product discovery, checkout, order tracking, vendor operations, and admin moderation workflows.";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  const body = (req.body || {}) as AssistantRequestBody;

  const rawMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (!rawMessage) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (rawMessage.length > 500) {
    return res.status(400).json({ error: "Message is too long" });
  }

  const role = normalizeRole(body.role, session?.user?.role);
  const context = normalizeContext(body.context);
  const reply = buildReply(rawMessage, context, role, body.metadata || {});

  return res.status(200).json({
    reply,
    suggestions: createSuggestions(context, role),
  });
}
