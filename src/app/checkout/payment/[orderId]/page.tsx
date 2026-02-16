"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { STRIPE_APPEARANCE } from "@/lib/payments/stripe-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import MpesaPaymentForm from "@/components/checkout/MpesaPaymentForm";
import PaymentMethodSelector from "@/components/checkout/PaymentMethodSelector";

const stripePromise = getStripe();

// Content component that uses params
function PaymentPageContent() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Get the orderId from the URL without using useParams
  const orderId = typeof window !== 'undefined'
    ? window.location.pathname.split('/').pop()
    : '';

  const [order, setOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push(`/auth/login?callbackUrl=/checkout/payment/${orderId}`);
      return;
    }

    const fetchOrderDetails = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch the order details first
        const orderResponse = await fetch(`/api/orders/${orderId}`);

        if (!orderResponse.ok) {
          const error = await orderResponse.json();
          toast.error(error.error || "Failed to load order details");
          router.push("/orders");
          return;
        }

        const orderData = await orderResponse.json();
        setOrder(orderData);

        // 2. Check if order is already paid
        if (orderData.paymentStatus === "paid") {
          toast.info("This order has already been paid");
          router.push(`/checkout/success?orderId=${orderId}`);
          return;
        }

        // 3. If not paid and the order belongs to the current user, set the default payment method
        if (orderData.paymentMethod) {
          setPaymentMethod(orderData.paymentMethod);
        }
      } catch (error) {
        console.error("Error fetching order details:", error);
        toast.error("An error occurred while loading the order");
      } finally {
        setIsLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId, session, status, router]);

  // Create payment intent when payment method changes
  useEffect(() => {
    if (!order || isLoading || paymentMethod !== "stripe") return;

    const createPaymentIntent = async () => {
      try {
        const response = await fetch("/api/payment/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            paymentMethod,
            returnUrl: window.location.origin + `/checkout/success?orderId=${orderId}`,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setClientSecret(data.clientSecret || "");
        } else {
          const error = await response.json();
          toast.error(error.error || "Failed to initialize payment");
        }
      } catch (error) {
        console.error("Error creating payment intent:", error);
        toast.error("Payment setup failed. Please try again.");
      }
    };

    createPaymentIntent();
  }, [order, orderId, paymentMethod, isLoading]);

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
  };

  const handleSuccess = () => {
    router.push(`/checkout/success?orderId=${orderId}`);
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#e16b22] border-t-transparent rounded-full inline-block mb-4"></div>
          <p>Loading payment options...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Redirect is handled in the useEffect
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Order Not Found</h1>
          <p className="mb-6">We couldn't find the order you're looking for. It may have been cancelled or doesn't exist.</p>
          <Button asChild>
            <Link href="/orders">View Your Orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-8 text-center">Complete Your Payment</h1>

        <div className="grid gap-8 md:grid-cols-5">
          {/* Payment methods - 3 columns */}
          <div className="md:col-span-3 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <PaymentMethodSelector
                  onSelect={handlePaymentMethodChange}
                  selected={paymentMethod}
                />

                {/* Payment Forms */}
                <div className="mt-8">
                  {paymentMethod === "stripe" && clientSecret ? (
                    <div>
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret,
                          appearance: STRIPE_APPEARANCE,
                        }}
                      >
                        <CheckoutForm
                          shippingAddress={order.shippingAddress}
                          billingAddress={order.billingAddress}
                          onSuccess={handleSuccess}
                        />
                      </Elements>
                    </div>
                  ) : paymentMethod === "stripe" && !clientSecret ? (
                    <div className="text-center py-4">
                      <div className="animate-spin h-6 w-6 border-4 border-[#e16b22] border-t-transparent rounded-full inline-block mb-2"></div>
                      <p>Initializing payment...</p>
                    </div>
                  ) : null}

                  {paymentMethod === "mpesa" && (
                    <MpesaPaymentForm
                      shippingAddress={order.shippingAddress}
                      billingAddress={order.billingAddress}
                      onSuccess={handleSuccess}
                      orderId={orderId}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order summary - 2 columns */}
          <div className="md:col-span-2">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Brief order details */}
                <div className="text-sm">
                  <p className="font-medium">Order #{order.orderNumber}</p>
                </div>

                <Separator />

                {/* Show first few items or count */}
                <div className="space-y-2">
                  {order.orderItems.slice(0, 2).map((item: any) => {
                    return (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100">
                          <img
                            src={item.productImage || '/placeholder-product.jpg'}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 text-sm">
                          <p className="truncate">{item.productName}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                    );
                  })}

                  {order.orderItems.length > 2 && (
                    <p className="text-xs text-gray-500 italic">
                      +{order.orderItems.length - 2} more {order.orderItems.length - 2 === 1 ? "item" : "items"}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Price breakdown */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>${(Number(order.totalAmount) - Number(order.taxAmount) - Number(order.shippingAmount) + Number(order.discountAmount)).toFixed(2)}</span>
                  </div>
                  {Number(order.shippingAmount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span>${Number(order.shippingAmount).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(order.taxAmount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>${Number(order.taxAmount).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(order.discountAmount) > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-${Number(order.discountAmount).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>${Number(order.totalAmount).toFixed(2)}</span>
                </div>

                {/* Cancel button */}
                <div className="pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <Link href="/orders">
                      Cancel Payment
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
export default function ResumePaymentPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#e16b22] border-t-transparent rounded-full inline-block mb-4"></div>
          <p>Loading payment options...</p>
        </div>
      </div>
    }>
      <PaymentPageContent />
    </Suspense>
  );
}
