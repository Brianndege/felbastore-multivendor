"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ChevronLeft,
  Truck,
  Package,
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import RoleAwareAssistant from "@/components/assistant/RoleAwareAssistant";
import OrderTimeline from "@/components/orders/OrderTimeline";

// Status badge styling
const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    case "confirmed":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "processing":
      return "bg-purple-100 text-purple-800 hover:bg-purple-100";
    case "shipped":
      return "bg-indigo-100 text-indigo-800 hover:bg-indigo-100";
    case "in_transit":
      return "bg-sky-100 text-sky-800 hover:bg-sky-100";
    case "delivered":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "cancelled":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    case "paid":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "failed":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return <Clock className="h-5 w-5" />;
    case "confirmed":
      return <CheckCircle className="h-5 w-5" />;
    case "processing":
      return <Package className="h-5 w-5" />;
    case "shipped":
      return <Truck className="h-5 w-5" />;
    case "in_transit":
      return <Truck className="h-5 w-5" />;
    case "delivered":
      return <CheckCircle className="h-5 w-5" />;
    case "cancelled":
      return <XCircle className="h-5 w-5" />;
    default:
      return <Clock className="h-5 w-5" />;
  }
};

// Order detail content component
function OrderDetailContent() {
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messageThreads, setMessageThreads] = useState<Record<string, Array<{ id: string; senderRole: string; senderId: string; message: string; createdAt: string }>>>({});
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [loadingThreads, setLoadingThreads] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const { data: session, status } = useSession();
  const assistantRole =
    session?.user?.role === "admin" || session?.user?.role === "vendor" || session?.user?.role === "user"
      ? session.user.role
      : "user";

  // Get the order ID from the URL without using useParams
  const id = typeof window !== 'undefined'
    ? window.location.pathname.split('/').pop()
    : '';

  const runLifecycleAction = async (vendorId: string, action: "confirm_receipt" | "open_dispute" | "request_refund") => {
    const reason =
      action === "open_dispute" || action === "request_refund"
        ? window.prompt(action === "open_dispute" ? "Describe the issue" : "Reason for refund request", "") || ""
        : "";

    try {
      const response = await fetch(`/api/orders/${id}/lifecycle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          Referer: window.location.href,
        },
        body: JSON.stringify({
          vendorId,
          action,
          reason,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to process action");
      }

      toast.success("Order lifecycle updated");
      const refreshed = await fetch(`/api/orders/${id}`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        setOrder(data);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process action");
    }
  };

  const loadVendorMessages = useCallback(async (vendorId: string) => {
    setLoadingThreads((prev) => ({ ...prev, [vendorId]: true }));
    try {
      const response = await fetch(`/api/orders/${id}/messages?vendorId=${encodeURIComponent(vendorId)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load messages");
      }
      setMessageThreads((prev) => ({ ...prev, [vendorId]: Array.isArray(payload.messages) ? payload.messages : [] }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load messages");
    } finally {
      setLoadingThreads((prev) => ({ ...prev, [vendorId]: false }));
    }
  }, [id]);

  const sendVendorMessage = async (vendorId: string) => {
    const draft = (messageDrafts[vendorId] || "").trim();
    if (!draft) return;

    try {
      const response = await fetch(`/api/orders/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          Referer: window.location.href,
        },
        body: JSON.stringify({ vendorId, message: draft }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send message");
      }

      setMessageDrafts((prev) => ({ ...prev, [vendorId]: "" }));
      await loadVendorMessages(vendorId);
      toast.success("Message sent to vendor");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    }
  };

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push(`/auth/login?callbackUrl=/orders/${id}`);
      return;
    }

    const fetchOrderDetails = async () => {
      try {
        const response = await fetch(`/api/orders/${id}`);

        if (response.ok) {
          const data = await response.json();
          setOrder(data);
        } else {
          const error = await response.json();
          toast.error(error.error || "Failed to fetch order details");
          if (response.status === 404) {
            router.push("/orders");
          }
        }
      } catch (error) {
        console.error("Error fetching order details:", error);
        toast.error("An error occurred while fetching order details");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchOrderDetails();
    }
  }, [id, session, status, router]);

  useEffect(() => {
    if (!Array.isArray(order?.vendorFulfillments)) return;

    for (const entry of order.vendorFulfillments) {
      if (!entry?.vendorId || messageThreads[entry.vendorId]) {
        continue;
      }
      void loadVendorMessages(entry.vendorId);
    }
  }, [order, messageThreads, loadVendorMessages]);

  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#e16b22] border-t-transparent rounded-full inline-block mb-4"></div>
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center mb-6">
            <Button asChild variant="outline" size="sm" className="mr-4">
              <Link href="/orders">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Orders
              </Link>
            </Button>
          </div>

          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Order not found</h3>
            <p className="text-gray-500 mb-6">
              The order you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button asChild className="bg-[#e16b22] hover:bg-[#cf610d]">
              <Link href="/orders">Back to My Orders</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button asChild variant="outline" size="sm" className="mr-4">
              <Link href="/orders">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Orders
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Order #{order.orderNumber}</h1>
          </div>
          <div>
            <Badge variant="outline" className={getStatusColor(order.status)}>
              {getStatusIcon(order.status)}
              <span className="ml-1">{String(order.status || "pending").replace(/_/g, " ")}</span>
            </Badge>
          </div>
        </div>

        <div className="mb-6">
          <RoleAwareAssistant
            role={assistantRole}
            context="order-detail"
            orderStatus={order.status}
            paymentStatus={order.paymentStatus}
            orderNumber={order.orderNumber}
            actions={[
              { label: "Back to Orders", href: "/orders", variant: "outline" },
              ...(order.status === "pending" && order.paymentStatus !== "paid"
                ? [{ label: "Complete Payment", href: `/checkout/payment/${order.id}` }]
                : []),
              ...(order.status === "shipped" || order.status === "delivered"
                ? [{ label: "Track Package", href: `/orders/${id}/track` }]
                : []),
            ]}
          />
        </div>

        {/* Order information cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.orderItems.map((item: any) => {
                    const images = typeof item.product?.images === 'string'
                      ? JSON.parse(item.product.images || '[]')
                      : item.product?.images || [];

                    return (
                      <div key={item.id} className="flex items-start gap-4 py-2">
                        <div className="h-20 w-20 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                          <img
                            src={item.productImage || images[0] || '/placeholder-product.jpg'}
                            alt={item.productName || item.product?.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <h4 className="font-medium">
                              {item.productName || item.product?.name}
                            </h4>
                            <span className="font-medium">
                              {formatCurrency(
                                ((typeof item.price === 'number' ? item.price : Number(item.price)) * item.quantity),
                                item.product?.currency || "KES"
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {formatCurrency((typeof item.price === 'number' ? item.price : Number(item.price)), item.product?.currency || "KES")} × {item.quantity}
                          </p>
                          {item.product?.vendor && (
                            <p className="text-sm text-gray-500">
                              Sold by: {item.product.vendor.storeName || item.product.vendor.name}
                            </p>
                          )}

                          {order.status === "delivered" && (
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                              >
                                <Link href={`/reviews/write?productId=${item.product.id}&orderId=${order.id}`}>
                                  Write a Review
                                </Link>
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Shipping Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Shipping Address */}
                  <div>
                    <h3 className="font-medium mb-2">Shipping Address</h3>
                    {order.shippingAddress && (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">
                          {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                        </p>
                        <p>{order.shippingAddress.address}</p>
                        <p>
                          {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                        </p>
                        <p>{order.shippingAddress.country}</p>
                        {order.shippingAddress.phone && <p>Phone: {order.shippingAddress.phone}</p>}
                      </div>
                    )}
                  </div>

                  {/* Billing Address */}
                  <div>
                    <h3 className="font-medium mb-2">Billing Address</h3>
                    {order.billingAddress && (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">
                          {order.billingAddress.firstName} {order.billingAddress.lastName}
                        </p>
                        <p>{order.billingAddress.address}</p>
                        <p>
                          {order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.zipCode}
                        </p>
                        <p>{order.billingAddress.country}</p>
                        {order.billingAddress.phone && <p>Phone: {order.billingAddress.phone}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Vendor Fulfillment Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.isArray(order.vendorFulfillments) && order.vendorFulfillments.length > 0 ? (
                  order.vendorFulfillments.map((entry: any) => (
                    <div key={entry.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{entry.vendorName || "Vendor"}</p>
                        <Badge variant="outline" className={getStatusColor(entry.orderStatus || "pending")}>
                          {(entry.orderStatus || "pending").replace("_", " ")}
                        </Badge>
                      </div>

                      <div className="mt-2 text-sm text-gray-600 space-y-1">
                        <p>Shipping status: {(entry.shippingStatus || "pending").replace("_", " ")}</p>
                        {entry.shippingProvider ? <p>Carrier: {entry.shippingProvider}</p> : null}
                        {entry.trackingNumber ? <p>Tracking #: {entry.trackingNumber}</p> : null}
                        {entry.trackingUrl ? (
                          <p>
                            Tracking link: <a className="text-blue-600 underline" href={entry.trackingUrl} target="_blank" rel="noreferrer">Open tracking</a>
                          </p>
                        ) : null}
                        {entry.estimatedDeliveryAt ? <p>Estimated delivery: {format(new Date(entry.estimatedDeliveryAt), "MMM d, yyyy")}</p> : null}
                      </div>

                      <div className="mt-3">
                        <OrderTimeline
                          status={entry.orderStatus || "pending"}
                          timestamps={{
                            confirmedAt: entry.confirmedAt,
                            processedAt: entry.processingAt,
                            shippedAt: entry.shippedAt,
                            deliveredAt: entry.deliveredAt,
                          }}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void runLifecycleAction(entry.vendorId, "confirm_receipt")}
                          disabled={entry.orderStatus !== "delivered" && entry.orderStatus !== "completed"}
                        >
                          Confirm Receipt
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void runLifecycleAction(entry.vendorId, "open_dispute")}
                        >
                          Open Dispute
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void runLifecycleAction(entry.vendorId, "request_refund")}
                        >
                          Request Refund
                        </Button>
                      </div>

                      <div className="mt-4 rounded-md border bg-gray-50 p-3">
                        <p className="text-sm font-medium">Message Vendor</p>
                        <div className="mt-2 space-y-2">
                          {loadingThreads[entry.vendorId] ? (
                            <p className="text-xs text-gray-500">Loading messages...</p>
                          ) : Array.isArray(messageThreads[entry.vendorId]) && messageThreads[entry.vendorId].length > 0 ? (
                            messageThreads[entry.vendorId].map((msg) => (
                              <div key={msg.id} className="rounded border bg-white px-2 py-1 text-xs">
                                <p className="font-medium capitalize">{msg.senderRole}</p>
                                <p>{msg.message}</p>
                                <p className="text-gray-500">{format(new Date(msg.createdAt), "MMM d, yyyy HH:mm")}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-500">No messages yet for this vendor.</p>
                          )}
                        </div>

                        <div className="mt-2 flex gap-2">
                          <input
                            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                            value={messageDrafts[entry.vendorId] || ""}
                            onChange={(event) =>
                              setMessageDrafts((prev) => ({ ...prev, [entry.vendorId]: event.target.value }))
                            }
                            placeholder="Write a message to this vendor"
                          />
                          <Button size="sm" variant="outline" onClick={() => void sendVendorMessage(entry.vendorId)}>
                            Send
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No vendor timeline data available yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            {/* Payment Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-gray-500" />
                      <h3 className="font-medium">Payment</h3>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Status</span>
                      <Badge
                        variant="outline"
                        className={getStatusColor(order.paymentStatus)}
                      >
                        {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm text-gray-500">Method</span>
                      <span className="text-sm">
                        {order.paymentMethod === "stripe"
                          ? "Credit Card"
                          : order.paymentMethod === "mpesa"
                          ? "M-Pesa"
                          : order.paymentMethod || "Not specified"}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-2">Order Details</h3>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Order Date</span>
                        <span className="text-sm">{format(new Date(order.createdAt), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Order Number</span>
                        <span className="text-sm">{order.orderNumber}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Price Breakdown */}
                  <div>
                    <h3 className="font-medium mb-2">Price Details</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Subtotal</span>
                        <span className="text-sm">{formatCurrency((Number(order.totalAmount) - Number(order.taxAmount) - Number(order.shippingAmount) + Number(order.discountAmount)), order.orderItems?.[0]?.product?.currency || "KES")}</span>
                      </div>
                      {Number(order.shippingAmount) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Shipping</span>
                          <span className="text-sm">{formatCurrency(Number(order.shippingAmount), order.orderItems?.[0]?.product?.currency || "KES")}</span>
                        </div>
                      )}
                      {Number(order.taxAmount) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Tax</span>
                          <span className="text-sm">{formatCurrency(Number(order.taxAmount), order.orderItems?.[0]?.product?.currency || "KES")}</span>
                        </div>
                      )}
                      {Number(order.discountAmount) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Discount</span>
                          <span className="text-sm text-green-600">-{formatCurrency(Number(order.discountAmount), order.orderItems?.[0]?.product?.currency || "KES")}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span>{formatCurrency(Number(order.totalAmount), order.orderItems?.[0]?.product?.currency || "KES")}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {(order.status === "pending" && order.paymentStatus !== "paid") && (
                  <div className="mt-6">
                    <Button
                      className="w-full bg-[#e16b22] hover:bg-[#cf610d]"
                      asChild
                    >
                      <Link href={`/checkout/payment/${order.id}`}>
                        Complete Payment
                      </Link>
                    </Button>
                  </div>
                )}

                {order.status === "pending" && (
                  <div className="mt-6">
                    <Button
                      variant="outline"
                      className="w-full text-red-500 hover:bg-red-50"
                      onClick={() => {
                        // Cancel order logic
                        toast.info("This feature is coming soon");
                      }}
                    >
                      Cancel Order
                    </Button>
                  </div>
                )}

                {(order.status === "delivered") && (
                  <div className="mt-6">
                    <Button
                      className="w-full bg-[#e16b22] hover:bg-[#cf610d]"
                      asChild
                    >
                      <Link href={`/orders/${id}/track`}>
                        Track Package
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Need Help */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    asChild
                  >
                    <Link href="/contact">
                      Contact Support
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    asChild
                  >
                    <Link href="/returns">
                      Return Policy
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component with suspense boundary
export default function OrderDetailPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#e16b22] border-t-transparent rounded-full inline-block mb-4"></div>
          <p>Loading order details...</p>
        </div>
      </div>
    }>
      <OrderDetailContent />
    </Suspense>
  );
}
