"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { STRIPE_APPEARANCE } from "@/lib/payments/stripe-provider";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import MpesaPaymentForm from "@/components/checkout/MpesaPaymentForm";
import PaymentMethodSelector from "@/components/checkout/PaymentMethodSelector";
import { toast } from "sonner";

const stripePromise = getStripe();

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { items, getCartTotal, getCartCount } = useCart();
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("stripe");

  // Address state
  const [shippingAddress, setShippingAddress] = useState({
    firstName: "",
    lastName: "",
    email: session?.user?.email || "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US",
  });

  const [billingAddress, setBillingAddress] = useState(shippingAddress);
  const [sameAsShipping, setSameAsShipping] = useState(true);

  // Payment stage state
  const [paymentStage, setPaymentStage] = useState<"address" | "payment">("address");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth/login?callbackUrl=/checkout");
      return;
    }
    if (session.user.role !== "user") {
      router.push("/");
      return;
    }
    if (items.length === 0) {
      router.push("/cart");
      return;
    }
  }, [session, status, router, items]);

  useEffect(() => {
    if (session?.user?.email) {
      setShippingAddress(prev => ({ ...prev, email: session.user.email }));
    }
  }, [session]);

  useEffect(() => {
    if (sameAsShipping) {
      setBillingAddress(shippingAddress);
    }
  }, [sameAsShipping, shippingAddress]);

  const createPaymentIntent = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/payment/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const { clientSecret } = await response.json();
        setClientSecret(clientSecret);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Error creating payment intent");
      }
    } catch (error) {
      console.error("Error creating payment intent:", error);
      toast.error("Failed to initialize payment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (items.length > 0 && paymentMethod === "stripe" && paymentStage === "payment") {
      createPaymentIntent();
    }
  }, [items, paymentMethod, paymentStage]);

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full inline-block mb-4"></div>
          <p>Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== "user" || items.length === 0) {
    return null;
  }

  const cartTotal = getCartTotal();
  const taxAmount = cartTotal * 0.1;
  const totalAmount = cartTotal + taxAmount;

  const handleAddressChange = (field: string, value: string, isBilling = false) => {
    if (isBilling) {
      setBillingAddress(prev => ({ ...prev, [field]: value }));
    } else {
      setShippingAddress(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required address fields
    const requiredFields = ['firstName', 'lastName', 'email', 'address', 'city', 'state', 'zipCode'];
    const missingFields = requiredFields.filter(field => !shippingAddress[field as keyof typeof shippingAddress]);

    if (missingFields.length > 0) {
      toast.error(`Please complete the following fields: ${missingFields.join(', ')}`);
      return;
    }

    // Proceed to payment step
    setPaymentStage("payment");
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
  };

  const handleSuccess = () => {
    router.push("/orders");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-3 lg:grid-flow-row-dense">
        {/* Left Column - Forms (spans 2 columns for desktop) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Checkout Progress */}
          <div className="mb-8">
            <Tabs defaultValue={paymentStage} value={paymentStage} onValueChange={(value) => setPaymentStage(value as "address" | "payment")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="address"
                  className="data-[state=active]:bg-[#e16b22] data-[state=active]:text-white"
                >
                  1. Shipping
                </TabsTrigger>
                <TabsTrigger
                  value="payment"
                  disabled={paymentStage === "address"}
                  className="data-[state=active]:bg-[#e16b22] data-[state=active]:text-white"
                >
                  2. Payment
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Address Form */}
          {paymentStage === "address" && (
            <form onSubmit={handleAddressSubmit}>
              {/* Shipping Address */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Shipping Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={shippingAddress.firstName}
                        onChange={(e) => handleAddressChange("firstName", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={shippingAddress.lastName}
                        onChange={(e) => handleAddressChange("lastName", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={shippingAddress.email}
                      onChange={(e) => handleAddressChange("email", e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={shippingAddress.phone}
                      onChange={(e) => handleAddressChange("phone", e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={shippingAddress.address}
                      onChange={(e) => handleAddressChange("address", e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={shippingAddress.city}
                        onChange={(e) => handleAddressChange("city", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={shippingAddress.state}
                        onChange={(e) => handleAddressChange("state", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        value={shippingAddress.zipCode}
                        onChange={(e) => handleAddressChange("zipCode", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Billing Address */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Billing Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={sameAsShipping}
                        onChange={(e) => setSameAsShipping(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span>Same as shipping address</span>
                    </label>
                  </div>

                  {!sameAsShipping && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="billingFirstName">First Name</Label>
                          <Input
                            id="billingFirstName"
                            value={billingAddress.firstName}
                            onChange={(e) => handleAddressChange("firstName", e.target.value, true)}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="billingLastName">Last Name</Label>
                          <Input
                            id="billingLastName"
                            value={billingAddress.lastName}
                            onChange={(e) => handleAddressChange("lastName", e.target.value, true)}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="billingEmail">Email</Label>
                        <Input
                          id="billingEmail"
                          type="email"
                          value={billingAddress.email}
                          onChange={(e) => handleAddressChange("email", e.target.value, true)}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="billingPhone">Phone</Label>
                        <Input
                          id="billingPhone"
                          value={billingAddress.phone}
                          onChange={(e) => handleAddressChange("phone", e.target.value, true)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="billingAddress">Address</Label>
                        <Input
                          id="billingAddress"
                          value={billingAddress.address}
                          onChange={(e) => handleAddressChange("address", e.target.value, true)}
                          required
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <Label htmlFor="billingCity">City</Label>
                          <Input
                            id="billingCity"
                            value={billingAddress.city}
                            onChange={(e) => handleAddressChange("city", e.target.value, true)}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="billingState">State</Label>
                          <Input
                            id="billingState"
                            value={billingAddress.state}
                            onChange={(e) => handleAddressChange("state", e.target.value, true)}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="billingZipCode">ZIP Code</Label>
                          <Input
                            id="billingZipCode"
                            value={billingAddress.zipCode}
                            onChange={(e) => handleAddressChange("zipCode", e.target.value, true)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit" size="lg" className="bg-[#e16b22] hover:bg-[#cf610d]">
                  Proceed to Payment
                </Button>
              </div>
            </form>
          )}

          {/* Payment Methods */}
          {paymentStage === "payment" && (
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
                          shippingAddress={shippingAddress}
                          billingAddress={billingAddress}
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
                      shippingAddress={shippingAddress}
                      billingAddress={billingAddress}
                      onSuccess={handleSuccess}
                      orderId={orderId}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Order Summary */}
        <div className="lg:row-span-2">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cart Items */}
              <div className="space-y-2">
                {items.map((item) => {
                  const images = typeof item.product.images === 'string'
                    ? JSON.parse(item.product.images || '[]')
                    : item.product.images || [];

                  const price = typeof item.product.price === 'number'
                    ? item.product.price
                    : parseFloat(item.product.price.toString());

                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100">
                        <img
                          src={images[0] || '/placeholder-product.jpg'}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.product.name}</h4>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-sm font-medium">
                        ${(price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal ({getCartCount()} items)</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="text-green-600">Free</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Back to cart button */}
              <div className="mt-6">
                <Button variant="outline" size="sm" className="w-full" onClick={() => router.push('/cart')}>
                  Back to Cart
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
