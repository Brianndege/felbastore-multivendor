"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";

type VendorOrderItem = {
  id: string;
  quantity: number;
  price: number;
  productName: string;
  productImage?: string | null;
  currency: string;
};

type VendorOrder = {
  id: string;
  orderNumber: string;
  status: string;
  shippingStatus?: string;
  trackingNumber?: string | null;
  shippingProvider?: string | null;
  trackingUrl?: string | null;
  estimatedDeliveryAt?: string | null;
  confirmationDueAt?: string | null;
  paymentStatus: string;
  paymentMethod?: string | null;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  vendorAmount: number;
  currency: string;
  notes?: string | null;
  canUpdateStatus: boolean;
  customer: {
    name: string;
    email: string;
    phone?: string | null;
  };
  shippingAddress?: Record<string, unknown> | null;
  orderItems: VendorOrderItem[];
  timeline?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorRole: string;
    note?: string | null;
    createdAt: string;
  }>;
};

const PROGRESSION_OPTIONS = ["pending", "confirmed", "processing", "shipped", "in_transit", "delivered", "cancelled"];

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "confirmed":
      return "bg-blue-100 text-blue-800";
    case "processing":
      return "bg-purple-100 text-purple-800";
    case "shipped":
      return "bg-indigo-100 text-indigo-800";
    case "delivered":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function VendorOrderDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [order, setOrder] = useState<VendorOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState("");
  const [shippingProvider, setShippingProvider] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; senderRole: string; message: string; createdAt: string }>>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const orderId = typeof window !== "undefined" ? window.location.pathname.split("/").pop() || "" : "";

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "vendor") {
      router.push(`/auth/login?callbackUrl=/vendors/dashboard/orders/${orderId}`);
      return;
    }

    const loadOrder = async () => {
      setLoadingOrder(true);
      try {
        const response = await fetch(`/api/vendor/orders/${orderId}`);
        const payload = (await response.json()) as { order?: VendorOrder; error?: string };

        if (!response.ok || !payload.order) {
          throw new Error(payload.error || "Order not found");
        }

        setOrder(payload.order);
        setStatusDraft(payload.order.status);
        setShippingProvider(payload.order.shippingProvider || "");
        setTrackingNumber(payload.order.trackingNumber || "");
        setTrackingUrl(payload.order.trackingUrl || "");
        setEstimatedDeliveryAt(payload.order.estimatedDeliveryAt ? String(payload.order.estimatedDeliveryAt).slice(0, 10) : "");
      } catch (error) {
        console.error("Failed to load vendor order:", error);
        toast.error(error instanceof Error ? error.message : "Failed to load order");
        router.push("/vendors/dashboard/orders");
      } finally {
        setLoadingOrder(false);
      }
    };

    if (orderId) {
      void loadOrder();
    }
  }, [orderId, router, session, status]);

  const loadMessages = useCallback(async () => {
    if (!orderId) return;
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`);
      const payload = (await response.json()) as { messages?: Array<{ id: string; senderRole: string; message: string; createdAt: string }>; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load messages");
      }
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load messages");
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId && session?.user?.role === "vendor") {
      void loadMessages();
    }
  }, [orderId, session?.user?.role, loadMessages]);

  const sendMessage = async () => {
    const message = messageDraft.trim();
    if (!message || !orderId) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          Referer: window.location.href,
        },
        body: JSON.stringify({ message }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send message");
      }

      setMessageDraft("");
      await loadMessages();
      toast.success("Message sent to customer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const formattedAddress = useMemo(() => {
    if (!order?.shippingAddress) return [];

    const address = order.shippingAddress;
    const parts = [
      [address.firstName, address.lastName].filter(Boolean).join(" "),
      address.address,
      [address.city, address.state, address.zipCode].filter(Boolean).join(", "),
      address.country,
      address.phone,
    ];

    return parts.filter((entry) => typeof entry === "string" && entry.trim().length > 0) as string[];
  }, [order?.shippingAddress]);

  const handleStatusUpdate = async () => {
    if (!order || !statusDraft || statusDraft === order.status) return;

    setUpdatingStatus(true);
    try {
      const requestBody: Record<string, string> = { status: statusDraft };
      if (statusDraft === "shipped") {
        requestBody.shippingProvider = shippingProvider;
        requestBody.trackingNumber = trackingNumber;
        requestBody.trackingUrl = trackingUrl;
        if (estimatedDeliveryAt) {
          requestBody.estimatedDeliveryAt = new Date(`${estimatedDeliveryAt}T00:00:00.000Z`).toISOString();
        }
      }

      const response = await fetch(`/api/vendor/orders/${order.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          Referer: window.location.href,
        },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json()) as {
        error?: string;
        order?: {
          status: string;
          shippingStatus?: string;
          trackingNumber?: string | null;
          shippingProvider?: string | null;
          trackingUrl?: string | null;
          estimatedDeliveryAt?: string | null;
        };
      };
      if (!response.ok || !payload.order) {
        throw new Error(payload.error || "Failed to update order status");
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: payload.order!.status,
              shippingStatus: payload.order!.shippingStatus || prev.shippingStatus,
              trackingNumber: payload.order!.trackingNumber || prev.trackingNumber,
              shippingProvider: payload.order!.shippingProvider || prev.shippingProvider,
              trackingUrl: payload.order!.trackingUrl || prev.trackingUrl,
              estimatedDeliveryAt: payload.order!.estimatedDeliveryAt || prev.estimatedDeliveryAt,
            }
          : prev
      );
      toast.success("Order status updated");
    } catch (error) {
      console.error("Failed to update vendor order status:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update order status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (status === "loading" || loadingOrder) {
    return <p className="text-sm text-muted-foreground">Loading order...</p>;
  }

  if (!order) {
    return <p className="text-sm text-muted-foreground">Order not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/vendors/dashboard/orders">Back to orders</Link>
        </Button>
        <h1 className="text-2xl font-semibold">Order #{order.orderNumber}</h1>
        <Badge className={getStatusBadgeClass(order.status)}>{order.status}</Badge>
        <Badge variant="outline">Payment: {order.paymentStatus}</Badge>
        {order.shippingStatus ? <Badge variant="outline">Shipping: {order.shippingStatus}</Badge> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.customer.name}</p>
            <p>{order.customer.email}</p>
            {order.customer.phone && <p>{order.customer.phone}</p>}
            <p className="pt-2 text-xs text-muted-foreground">Placed {format(new Date(order.createdAt), "MMM d, yyyy HH:mm")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {formattedAddress.length > 0 ? formattedAddress.map((line) => <p key={line}>{line}</p>) : <p className="text-muted-foreground">No shipping address available.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vendor Status Update</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {order.confirmationDueAt && order.status === "pending" ? (
            <p className="text-xs text-amber-700 sm:basis-full">
              Confirm this order before {format(new Date(order.confirmationDueAt), "MMM d, yyyy HH:mm")} to avoid admin escalation.
            </p>
          ) : null}
          {!order.canUpdateStatus && (
            <p className="text-xs text-amber-700 sm:basis-full">
              This is a multi-vendor order. Status progression is managed centrally to avoid conflicting delivery states.
            </p>
          )}
          <Select value={statusDraft} onValueChange={setStatusDraft}>
            <SelectTrigger className="sm:w-[220px]" disabled={!order.canUpdateStatus}>
              <SelectValue placeholder="Choose status" />
            </SelectTrigger>
            <SelectContent>
              {PROGRESSION_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusDraft === "shipped" && (
            <div className="grid gap-2 sm:grid-cols-2 sm:basis-full">
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={shippingProvider}
                onChange={(event) => setShippingProvider(event.target.value)}
                placeholder="Shipping provider"
              />
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="Tracking number"
              />
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={trackingUrl}
                onChange={(event) => setTrackingUrl(event.target.value)}
                placeholder="Tracking URL (optional)"
              />
              <input
                type="date"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={estimatedDeliveryAt}
                onChange={(event) => setEstimatedDeliveryAt(event.target.value)}
              />
            </div>
          )}
          <Button
            type="button"
            onClick={() => void handleStatusUpdate()}
            disabled={!order.canUpdateStatus || updatingStatus || statusDraft === order.status}
          >
            {updatingStatus ? "Updating..." : "Update status"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Customer Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingMessages ? (
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          ) : messages.length > 0 ? (
            <div className="space-y-2">
              {messages.map((entry) => (
                <div key={entry.id} className="rounded border p-2 text-sm">
                  <p className="font-medium capitalize">{entry.senderRole}</p>
                  <p>{entry.message}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          )}

          <div className="flex gap-2">
            <input
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="Message customer about this order"
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
            />
            <Button type="button" onClick={() => void sendMessage()} disabled={sendingMessage || messageDraft.trim().length === 0}>
              {sendingMessage ? "Sending..." : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {Array.isArray(order.timeline) && order.timeline.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {order.timeline.map((entry) => (
                <li key={entry.id} className="rounded-md border p-2">
                  <p className="font-medium">
                    {entry.fromStatus ? `${entry.fromStatus} -> ${entry.toStatus}` : entry.toStatus}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actorRole} • {format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}
                  </p>
                  {entry.note ? <p className="text-xs text-muted-foreground">{entry.note}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No timeline updates yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Items in this order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.orderItems.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 overflow-hidden rounded bg-muted">
                  <img
                    src={item.productImage || "/placeholder-product.jpg"}
                    alt={item.productName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
              </div>
              <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity, item.currency)}</p>
            </div>
          ))}
          <div className="flex justify-between border-t pt-3 text-sm">
            <span>Your payout total</span>
            <span className="font-semibold">{formatCurrency(order.vendorAmount, order.currency)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Order grand total</span>
            <span>{formatCurrency(order.totalAmount, order.currency)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
