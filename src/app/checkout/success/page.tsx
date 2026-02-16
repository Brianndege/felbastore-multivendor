"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const orderId = searchParams.get("orderId");
  const paymentId = searchParams.get("paymentId");

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/login");
      return;
    }

    if (!orderId && !paymentId) {
      router.push("/orders");
      return;
    }

    const fetchOrderDetails = async () => {
      try {
        // If we have a paymentId, we need to verify it first
        if (paymentId) {
          await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentId,
              paymentMethod: searchParams.get("method") || "stripe",
            }),
          });
        }

        // Now fetch the order details
        let id = orderId;

        // If we don't have orderId but have paymentId, find the order by paymentId
        if (!id && paymentId) {
          const res = await fetch(`/api/orders/by-payment/${paymentId}`);
          if (res.ok) {
            const data = await res.json();
            id = data.orderId;
          }
        }

        if (id) {
          const res = await fetch(`/api/orders/${id}`);
          if (res.ok) {
            const orderData = await res.json();
            setOrder(orderData);
          }
        }
      } catch (error) {
        console.error("Error fetching order details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [session, status, orderId, paymentId, router, searchParams]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#e16b22] border-t-transparent rounded-full inline-block mb-4"></div>
          <p>Processing your order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-green-100 p-4 rounded-full">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4">Thank You for Your Order!</h1>
        <p className="text-xl mb-8 text-gray-600">
          {order ? `Order #${order.orderNumber} has been confirmed.` : "Your order has been confirmed."}
        </p>

        {order && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Order Number</h3>
                    <p className="font-medium">{order.orderNumber}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Order Date</h3>
                    <p className="font-medium">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Payment Method</h3>
                    <p className="font-medium">
                      {order.paymentMethod === "stripe" ? "Credit Card" :
                       order.paymentMethod === "mpesa" ? "M-Pesa" :
                       order.paymentMethod || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Payment Status</h3>
                    <p className="font-medium">
                      {order.paymentStatus === "paid" ? (
                        <span className="text-green-600">Paid</span>
                      ) : (
                        order.paymentStatus
                      )}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Order Summary</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>${(Number(order.totalAmount) - Number(order.taxAmount) - Number(order.shippingAmount) + Number(order.discountAmount)).toFixed(2)}</span>
                    </div>
                    {Number(order.shippingAmount) > 0 && (
                      <div className="flex justify-between">
                        <span>Shipping</span>
                        <span>${Number(order.shippingAmount).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(order.taxAmount) > 0 && (
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span>${Number(order.taxAmount).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(order.discountAmount) > 0 && (
                      <div className="flex justify-between">
                        <span>Discount</span>
                        <span>-${Number(order.discountAmount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-2 border-t mt-2">
                      <span>Total</span>
                      <span>${Number(order.totalAmount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild className="bg-[#e16b22] hover:bg-[#cf610d]">
            <Link href="/orders">View Your Orders</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Continue Shopping</Link>
          </Button>
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>A confirmation email has been sent to your email address.</p>
          <p className="mt-2">
            If you have any questions about your order, please contact our{" "}
            <Link href="/contact" className="text-[#e16b22] hover:underline">
              customer support
            </Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
