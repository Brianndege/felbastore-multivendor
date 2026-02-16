"use client";

import { useState, useEffect, Suspense } from "react";
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
  const router = useRouter();
  const { data: session, status } = useSession();

  // Get the order ID from the URL without using useParams
  const id = typeof window !== 'undefined'
    ? window.location.pathname.split('/').pop()
    : '';

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
              <span className="ml-1">{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
            </Badge>
          </div>
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
                              ${((typeof item.price === 'number'
                                ? item.price
                                : parseFloat(item.price.toString())) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            ${(typeof item.price === 'number'
                              ? item.price
                              : parseFloat(item.price.toString())).toFixed(2)} × {item.quantity}
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
                        <span className="text-sm">${(Number(order.totalAmount) - Number(order.taxAmount) - Number(order.shippingAmount) + Number(order.discountAmount)).toFixed(2)}</span>
                      </div>
                      {Number(order.shippingAmount) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Shipping</span>
                          <span className="text-sm">${Number(order.shippingAmount).toFixed(2)}</span>
                        </div>
                      )}
                      {Number(order.taxAmount) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Tax</span>
                          <span className="text-sm">${Number(order.taxAmount).toFixed(2)}</span>
                        </div>
                      )}
                      {Number(order.discountAmount) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Discount</span>
                          <span className="text-sm text-green-600">-${Number(order.discountAmount).toFixed(2)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span>${Number(order.totalAmount).toFixed(2)}</span>
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
