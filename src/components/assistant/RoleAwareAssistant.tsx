"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AssistantRole = "guest" | "user" | "vendor" | "admin";

type AssistantContext = "product" | "checkout" | "vendor-dashboard" | "admin-dashboard" | "order-detail";

type AssistantAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "secondary" | "outline";
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type RoleAwareAssistantProps = {
  role: AssistantRole;
  context: AssistantContext;
  productName?: string;
  vendorName?: string;
  blockedVendorNames?: string[];
  pendingApprovals?: number;
  unreadModerationCount?: number;
  orderStatus?: string;
  paymentStatus?: string;
  orderNumber?: string;
  actions?: AssistantAction[];
};

function getRoleLabel(role: AssistantRole): string {
  if (role === "admin") return "Admin";
  if (role === "vendor") return "Vendor";
  if (role === "user") return "Customer";
  return "Guest";
}

export default function RoleAwareAssistant({
  role,
  context,
  productName,
  vendorName,
  blockedVendorNames = [],
  pendingApprovals,
  unreadModerationCount,
  orderStatus,
  paymentStatus,
  orderNumber,
  actions,
}: RoleAwareAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);

  const messages = useMemo(() => {
    if (context === "product") {
      return [
        `You are viewing${productName ? ` ${productName}` : " this product"}.`,
        vendorName ? `Sold by ${vendorName}. Check delivery expectations before checkout.` : "Review delivery details before checkout.",
        role === "guest"
          ? "Sign in to save your cart and track order status updates."
          : "Add to cart now and complete checkout when your address details are ready.",
      ];
    }

    if (context === "checkout") {
      const blockedSummary =
        blockedVendorNames.length > 0
          ? `Delivery issue detected for: ${blockedVendorNames.join(", ")}. Choose an available delivery range and re-check eligibility.`
          : "Shipping and payment options are validated in real time per vendor.";

      return [
        blockedSummary,
        "Confirm shipping details, then place the order with the approved payment method.",
        "After successful payment, you can track progress from your Orders page.",
      ];
    }

    if (context === "vendor-dashboard") {
      return [
        unreadModerationCount && unreadModerationCount > 0
          ? `You have ${unreadModerationCount} unread moderation notifications to review.`
          : "No urgent moderation notifications right now.",
        "Keep at least one active delivery zone to avoid checkout failures for your products.",
        "Review incoming orders frequently and move statuses quickly to improve customer trust.",
      ];
    }

    if (context === "order-detail") {
      const normalizedOrderStatus = (orderStatus || "").toLowerCase();
      const normalizedPaymentStatus = (paymentStatus || "").toLowerCase();

      return [
        orderNumber
          ? `Order ${orderNumber} is currently marked as ${normalizedOrderStatus || "pending"}.`
          : `Your order is currently marked as ${normalizedOrderStatus || "pending"}.`,
        normalizedOrderStatus === "pending" && normalizedPaymentStatus !== "paid"
          ? "Payment is still pending. Complete payment to start vendor fulfillment."
          : "Payment and status updates will continue to appear on this page.",
        normalizedOrderStatus === "shipped" || normalizedOrderStatus === "delivered"
          ? "Use tracking to monitor shipment progress and delivery confirmation."
          : "Need help with this order? Contact support directly from this page.",
      ];
    }

    return [
      typeof pendingApprovals === "number"
        ? `Pending approvals in queue: ${pendingApprovals}.`
        : "Review moderation and payment-method queues regularly.",
      "Use live monitoring to spot signup spikes, failed payments, and verification backlogs.",
      "When rejecting requests, include clear reasons so vendors can fix issues quickly.",
    ];
  }, [
    blockedVendorNames,
    context,
    orderNumber,
    orderStatus,
    paymentStatus,
    pendingApprovals,
    productName,
    role,
    unreadModerationCount,
    vendorName,
  ]);

  const defaultActions: AssistantAction[] = useMemo(() => {
    if (context === "product") {
      return role === "guest"
        ? [{ label: "Login", href: "/auth/login" }]
        : [
            { label: "View Cart", href: "/cart", variant: "outline" },
            { label: "Go to Checkout", href: "/checkout" },
          ];
    }

    if (context === "checkout") {
      return [
        { label: "Back to Cart", href: "/cart", variant: "outline" },
        { label: "My Orders", href: "/orders" },
      ];
    }

    if (context === "vendor-dashboard") {
      return [
        { label: "Manage Orders", href: "/vendors/dashboard/orders" },
        { label: "Add Product", href: "/vendors/dashboard/products", variant: "outline" },
      ];
    }

    if (context === "order-detail") {
      return [
        { label: "Back to Orders", href: "/orders", variant: "outline" },
        { label: "Contact Support", href: "/contact" },
      ];
    }

    return [
      { label: "Review Vendors", href: "/admin/vendors" },
      { label: "Moderation Queue", href: "/admin/dashboard", variant: "outline" },
    ];
  }, [context, role]);

  const quickActions = actions && actions.length > 0 ? actions : defaultActions;

  const seedConversation = () => {
    if (chatMessages.length > 0) {
      return;
    }

    setChatMessages(
      messages.map((message, index) => ({
        id: `seed-${index}`,
        role: "assistant",
        text: message,
      }))
    );
  };

  const sendQuestion = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: trimmed,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsSending(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          Referer: window.location.href,
        },
        body: JSON.stringify({
          role,
          context,
          message: trimmed,
          metadata: {
            productName,
            vendorName,
            blockedVendorNames,
            pendingApprovals,
            unreadModerationCount,
            orderStatus,
            paymentStatus,
            orderNumber,
          },
        }),
      });

      const payload = (await response.json()) as {
        reply?: string;
        suggestions?: string[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Assistant request failed");
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: payload.reply || "I am here to help with checkout, orders, vendors, and admin workflows.",
        },
      ]);
      setFollowUps(Array.isArray(payload.suggestions) ? payload.suggestions.slice(0, 3) : []);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant-error`,
          role: "assistant",
          text: "I could not process that right now. Please try again in a moment.",
        },
      ]);
      setFollowUps([]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendQuestion(question);
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Felba Assistant</CardTitle>
            <CardDescription>{getRoleLabel(role)} guidance for this page</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsExpanded((prev) => {
                const next = !prev;
                if (next) {
                  seedConversation();
                }
                return next;
              });
            }}
          >
            {isExpanded ? "Hide" : "Show"} tips
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {chatMessages.map((message) => (
              <p
                key={message.id}
                className={`rounded-md px-3 py-2 text-sm ${
                  message.role === "assistant"
                    ? "border border-amber-200 bg-white text-gray-700"
                    : "bg-amber-100 text-amber-950"
                }`}
              >
                {message.text}
              </p>
            ))}
          </div>

          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about this page, order status, or next steps"
              disabled={isSending}
            />
            <Button type="submit" size="sm" disabled={isSending || question.trim().length === 0}>
              {isSending ? "Sending..." : "Send"}
            </Button>
          </form>

          {followUps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {followUps.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void sendQuestion(suggestion);
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => {
              if (action.href) {
                return (
                  <Button key={action.label} asChild size="sm" variant={action.variant || "default"}>
                    <Link href={action.href}>{action.label}</Link>
                  </Button>
                );
              }

              return (
                <Button
                  key={action.label}
                  type="button"
                  size="sm"
                  variant={action.variant || "default"}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
