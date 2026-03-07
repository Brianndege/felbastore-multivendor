"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import VendorConfirmOrderButton from "./VendorConfirmOrderButton";

type VendorOrder = {
  id: string;
  orderNumber: string;
  status: string;
  shippingStatus: string;
  trackingNumber?: string | null;
  shippingProvider?: string | null;
  trackingUrl?: string | null;
  estimatedDeliveryAt?: string | null;
  confirmationDueAt?: string | null;
  paymentStatus: string;
  createdAt: string;
  totalAmount: number;
  vendorAmount: number;
  itemCount: number;
  currency: string;
  customer: {
    name?: string;
    email?: string;
  };
  canUpdateStatus: boolean;
};

const STATUS_TABS = ["all", "pending", "confirmed", "processing", "shipped", "in_transit", "delivered", "cancelled"] as const;

function formatOrderDate(value: string | undefined): string {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return format(parsed, "MMM d, yyyy HH:mm");
}

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

export default function VendorOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("all");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "vendor") {
      router.push("/auth/login?callbackUrl=/vendors/dashboard/orders");
      return;
    }

    const loadOrders = async () => {
      setLoadingOrders(true);
      try {
        const query = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
        const response = await fetch(`/api/vendor/orders${query}`);
        const rawBody = await response.text();
        let payload: { orders?: VendorOrder[]; error?: string } = {};

        try {
          payload = rawBody ? (JSON.parse(rawBody) as { orders?: VendorOrder[]; error?: string }) : {};
        } catch {
          payload = {
            error: response.ok
              ? "Unexpected non-JSON response from orders API"
              : `Orders API returned ${response.status} ${response.statusText}`,
          };
        }

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load orders");
        }

        setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      } catch (error) {
        console.error("Error loading vendor orders:", error);
        setOrders([]);
        toast.error(error instanceof Error ? error.message : "Failed to load orders");
      } finally {
        setLoadingOrders(false);
      }
    };

    void loadOrders();
  }, [router, session, status, statusFilter]);

  const totals = useMemo(() => {
    return {
      count: orders.length,
      pending: orders.filter((order) => ["pending", "confirmed", "processing"].includes(order.status)).length,
      delivered: orders.filter((order) => order.status === "delivered").length,
    };
  }, [orders]);

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">Track and progress your customer orders.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Total: {totals.count}</Badge>
          <Badge variant="outline">In progress: {totals.pending}</Badge>
          <Badge variant="outline">Delivered: {totals.delivered}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab}
            type="button"
            size="sm"
            variant={statusFilter === tab ? "default" : "outline"}
            onClick={() => setStatusFilter(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>

      {loadingOrders ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No orders found for this filter.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Order #{order.orderNumber}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Placed {formatOrderDate(order?.createdAt)} by {order?.customer?.name || "Customer"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getStatusBadgeClass(order?.status || "pending")}>{order?.status || "pending"}</Badge>
                    <Badge variant="outline">Payment: {order?.paymentStatus || "pending"}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Items</p>
                    <p className="font-medium">{order.itemCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Your share</p>
                    <p className="font-medium">{formatCurrency(order.vendorAmount, order.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Order total</p>
                    <p className="font-medium">{formatCurrency(order.totalAmount, order.currency)}</p>
                  </div>
                </div>
                {(order.shippingProvider || order.trackingNumber) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Shipping: {order.shippingProvider || "Carrier pending"}
                    {order.trackingNumber ? ` | Tracking: ${order.trackingNumber}` : ""}
                  </p>
                )}
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/vendors/dashboard/orders/${order.id}`}>View details</Link>
                    </Button>
                    <VendorConfirmOrderButton
                      orderId={order.id}
                      currentStatus={order.status}
                      canUpdateStatus={order.canUpdateStatus}
                    />
                  </div>
                  {!order.canUpdateStatus && (
                    <p className="mt-2 text-xs text-amber-700">
                      Multi-vendor order: status updates are managed centrally.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
