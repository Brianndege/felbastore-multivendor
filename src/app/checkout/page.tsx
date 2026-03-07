"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe-client";
import { STRIPE_APPEARANCE } from "@/lib/payments/stripe-provider";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import MpesaPaymentForm from "@/components/checkout/MpesaPaymentForm";
import PaymentMethodSelector from "@/components/checkout/PaymentMethodSelector";
import RoleAwareAssistant from "@/components/assistant/RoleAwareAssistant";
import { toast } from "sonner";

const stripePromise = getStripe();
const mpesaEnabled = process.env.NEXT_PUBLIC_ENABLE_MPESA === "true";

type EligibilityPaymentOption = {
  code: string;
  label: string;
  requiresApproval: boolean;
};

type VendorCoverage = {
  vendorId: string;
  vendorName?: string;
  vendorStoreName?: string;
  eligible: boolean;
  reason?: string;
  availableZones?: Array<{
    id: string;
    name: string;
    mode: string;
    radiusKm?: number;
  }>;
  selectedZoneId?: string;
};

type EligibilityResponse = {
  eligible: boolean;
  vendorCoverage: VendorCoverage[];
  paymentOptions: EligibilityPaymentOption[];
};

type ApiErrorPayload = {
  error?: string;
  code?: string;
  details?: Record<string, any>;
};

type BlockedVendor = {
  vendorId: string;
  name: string;
  reason?: string;
  availableZones?: Array<{
    id: string;
    name: string;
    mode: string;
    radiusKm?: number;
  }>;
};

function formatCoverageReason(reason?: string): string {
  if (!reason) return "Coverage unavailable";

  const reasonMap: Record<string, string> = {
    OUT_OF_RANGE: "Out of delivery range",
    NO_ACTIVE_ZONE: "No active delivery zone",
    MISSING_COORDINATES: "Address coordinates required",
    CITY_COUNTRY_MISMATCH: "City/country not supported",
    USER_SELECTED_ZONE: "Selected delivery zone",
  };

  return reasonMap[reason] || reason.replace(/_/g, " ").toLowerCase();
}

function getCoverageReasonBadgeVariant(reason?: string): "default" | "destructive" | "outline" | "secondary" {
  if (!reason) return "outline";

  if (reason === "OUT_OF_RANGE" || reason === "CITY_COUNTRY_MISMATCH") {
    return "destructive";
  }

  if (reason === "NO_ACTIVE_ZONE") {
    return "secondary";
  }

  return "outline";
}

function extractBlockedVendors(payload: ApiErrorPayload | null | undefined): BlockedVendor[] {
  if (!payload || payload.code !== "COVERAGE_OUT_OF_RANGE") {
    return [];
  }

  const coverage = payload.details?.vendorCoverage;
  if (!Array.isArray(coverage)) {
    return [];
  }

  return coverage
    .filter((entry: any) => entry && entry.eligible === false)
    .map((entry: any) => ({
      vendorId: String(entry.vendorId || entry.vendorStoreName || entry.vendorName || "unknown"),
      name: entry.vendorStoreName || entry.vendorName || entry.vendorId,
      reason: entry.reason,
      availableZones: Array.isArray(entry.availableZones) ? entry.availableZones : [],
    }))
    .filter((entry: BlockedVendor) => Boolean(entry.name));
}

function getCheckoutErrorMessage(payload: ApiErrorPayload | null | undefined, fallback: string): string {
  if (!payload) {
    return fallback;
  }

  const code = payload.code || "";
  const details = payload.details || {};

  if (code === "COVERAGE_OUT_OF_RANGE" && Array.isArray(details.vendorCoverage)) {
    const blockedVendors = details.vendorCoverage
      .filter((entry: any) => entry && entry.eligible === false)
      .map((entry: any) => entry.vendorStoreName || entry.vendorName || entry.vendorId)
      .filter(Boolean);

    if (blockedVendors.length > 0) {
      return `Delivery is unavailable for vendor(s): ${blockedVendors.join(", ")}. Please update shipping address.`;
    }

    return "Delivery is unavailable for one or more vendors in your cart.";
  }

  if (code === "PAYMENT_METHOD_NOT_ALLOWED") {
    const allowed = Array.isArray(details.allowed) ? details.allowed.join(", ") : "";
    return allowed
      ? `Selected payment method is not allowed for this cart. Allowed methods: ${allowed}.`
      : "Selected payment method is not allowed for this cart.";
  }

  if (code === "INSUFFICIENT_STOCK") {
    return payload.error || "One or more cart items are out of stock.";
  }

  return payload.error || fallback;
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { items, getCartTotal, getCartCount } = useCart();
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [blockedVendors, setBlockedVendors] = useState<BlockedVendor[]>([]);
  const [selectedVendorZones, setSelectedVendorZones] = useState<Record<string, string>>({});

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

  const createPaymentIntent = useCallback(async () => {
    setIsLoading(true);
    setCheckoutError("");
    setBlockedVendors([]);
    try {
      const response = await fetch("/api/payment/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            city: shippingAddress.city,
            country: shippingAddress.country,
          },
          selectedZoneIds: selectedVendorZones,
        }),
      });

      if (response.ok) {
        const { clientSecret } = await response.json();
        setClientSecret(clientSecret);
      } else {
        const errorData = (await response.json()) as ApiErrorPayload;
        const message = getCheckoutErrorMessage(errorData, "Error creating payment intent");
        setCheckoutError(message);
        setBlockedVendors(extractBlockedVendors(errorData));
        toast.error(message);
      }
    } catch (error) {
      console.error("Error creating payment intent:", error);
      const message = "Failed to initialize payment. Please try again.";
      setCheckoutError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedVendorZones, shippingAddress.city, shippingAddress.country]);

  const createPodOrder = async () => {
    setIsLoading(true);
    setCheckoutError("");
    setBlockedVendors([]);
    try {
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress,
          billingAddress,
          paymentMethod: "pod",
          selectedZoneIds: selectedVendorZones,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setBlockedVendors(extractBlockedVendors(payload));
        const message = getCheckoutErrorMessage(payload, "Failed to place order");
        throw new Error(message);
      }

      toast.success("Order placed successfully with Pay on Delivery.");
      handleSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to place order";
      setCheckoutError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getAllowedCheckoutMethods = (response: EligibilityResponse | null): string[] => {
    if (!response || !Array.isArray(response.paymentOptions)) {
      return [];
    }

    const optionCodes = new Set(response.paymentOptions.map((option) => option.code));
    const mapped: string[] = [];

    if (optionCodes.has("PAY_ON_DELIVERY")) {
      mapped.push("pod");
    }
    if (optionCodes.has("CARD")) {
      mapped.push("stripe");
    }
    if (optionCodes.has("MPESA") && mpesaEnabled) {
      mapped.push("mpesa");
    }

    return mapped;
  };

  useEffect(() => {
    if (items.length > 0 && paymentMethod === "stripe" && paymentStage === "payment") {
      createPaymentIntent();
    }
  }, [items, paymentMethod, paymentStage, createPaymentIntent]);

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

  const runEligibilityCheck = async () => {
    setCheckoutError("");
    setBlockedVendors([]);

    // Validate required address fields
    const requiredFields = ['firstName', 'lastName', 'email', 'address', 'city', 'state', 'zipCode'];
    const missingFields = requiredFields.filter(field => !shippingAddress[field as keyof typeof shippingAddress]);

    if (missingFields.length > 0) {
      toast.error(`Please complete the following fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsCheckingEligibility(true);
    try {
      const eligibilityResponse = await fetch("/api/checkout/eligibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: {
            city: shippingAddress.city,
            country: shippingAddress.country,
          },
          items: items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          selectedZoneIds: selectedVendorZones,
        }),
      });

      const payload = (await eligibilityResponse.json()) as EligibilityResponse & { error?: string };

      if (!eligibilityResponse.ok) {
        setBlockedVendors(extractBlockedVendors(payload as ApiErrorPayload));
        const message = getCheckoutErrorMessage(payload as ApiErrorPayload, "Failed to validate checkout eligibility");
        throw new Error(message);
      }

      setEligibility(payload);

      if (!payload.eligible) {
        setBlockedVendors(
          (payload.vendorCoverage || [])
            .filter((entry) => !entry.eligible)
            .map((entry) => ({
              vendorId: String(entry.vendorId),
              name: entry.vendorStoreName || entry.vendorName || entry.vendorId,
              reason: entry.reason,
              availableZones: Array.isArray(entry.availableZones) ? entry.availableZones : [],
            }))
            .filter((entry) => Boolean(entry.name))
        );
        setCheckoutError("Address is outside one or more vendor delivery ranges.");
        toast.error("Address is outside one or more vendor delivery ranges.");
        return;
      }

      const allowedMethods = getAllowedCheckoutMethods(payload);
      if (allowedMethods.length === 0) {
        toast.error("No payment methods are currently available for this cart.");
        return;
      }

      setPaymentMethod(allowedMethods[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Eligibility check failed";
      setCheckoutError(message);
      toast.error(message);
      return;
    } finally {
      setIsCheckingEligibility(false);
    }

    // Proceed to payment step
    setPaymentStage("payment");
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runEligibilityCheck();
  };

  const handleVendorZoneSelection = (vendorId: string, zoneId: string) => {
    setSelectedVendorZones((prev) => ({
      ...prev,
      [vendorId]: zoneId,
    }));
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
  };

  const handleSuccess = () => {
    router.push("/orders");
  };

  const allowedCheckoutMethods = getAllowedCheckoutMethods(eligibility);
  const canUseSelectedMethod = allowedCheckoutMethods.length === 0 || allowedCheckoutMethods.includes(paymentMethod);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="mb-6">
        <RoleAwareAssistant
          role="user"
          context="checkout"
          blockedVendorNames={blockedVendors.map((vendor) => vendor.name)}
        />
      </div>

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
                <Button type="submit" size="lg" className="bg-[#e16b22] hover:bg-[#cf610d]" disabled={isCheckingEligibility}>
                  {isCheckingEligibility ? "Checking eligibility..." : "Proceed to Payment"}
                </Button>
              </div>

              {paymentStage === "address" && (checkoutError || blockedVendors.length > 0) && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p>{checkoutError || "Address is outside one or more vendor delivery ranges."}</p>
                  {blockedVendors.length > 0 && (
                    <ul className="mt-2 list-disc pl-5">
                      {blockedVendors.map((vendor) => (
                        <li key={`${vendor.name}-${vendor.reason || "unknown"}`}>
                          <span className="font-medium">{vendor.name}</span>
                          {vendor.reason ? (
                            <Badge variant={getCoverageReasonBadgeVariant(vendor.reason)} className="ml-2 align-middle text-[10px] uppercase tracking-wide">
                              {formatCoverageReason(vendor.reason)}
                            </Badge>
                          ) : null}
                          {Array.isArray(vendor.availableZones) && vendor.availableZones.length > 0 && (
                            <div className="mt-2">
                              <Label htmlFor={`zone-${vendor.vendorId}`} className="text-xs">Choose delivery range for this vendor</Label>
                              <select
                                id={`zone-${vendor.vendorId}`}
                                className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                                value={selectedVendorZones[vendor.vendorId] || ""}
                                onChange={(event) => handleVendorZoneSelection(vendor.vendorId, event.target.value)}
                              >
                                <option value="">Select a range</option>
                                {vendor.availableZones.map((zone) => (
                                  <option key={zone.id} value={zone.id}>
                                    {zone.name}{typeof zone.radiusKm === "number" ? ` (${zone.radiusKm} km)` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {blockedVendors.some((vendor) => (vendor.availableZones || []).length > 0) && (
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void runEligibilityCheck()}>
                      Re-check With Selected Ranges
                    </Button>
                  )}
                </div>
              )}
            </form>
          )}

          {/* Payment Methods */}
          {paymentStage === "payment" && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {checkoutError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p>{checkoutError}</p>
                    {blockedVendors.length > 0 && (
                      <ul className="mt-2 list-disc pl-5">
                        {blockedVendors.map((vendor) => (
                          <li key={`payment-error-${vendor.name}-${vendor.reason || "unknown"}`}>
                            <span className="font-medium">{vendor.name}</span>
                            {vendor.reason ? (
                              <Badge variant={getCoverageReasonBadgeVariant(vendor.reason)} className="ml-2 align-middle text-[10px] uppercase tracking-wide">
                                {formatCoverageReason(vendor.reason)}
                              </Badge>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {eligibility && !eligibility.eligible && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p>Delivery is unavailable for one or more vendors in your cart. Update your shipping address to continue.</p>
                    {blockedVendors.length > 0 && (
                      <ul className="mt-2 list-disc pl-5">
                        {blockedVendors.map((vendor) => (
                          <li key={`payment-eligibility-${vendor.name}-${vendor.reason || "unknown"}`}>
                            <span className="font-medium">{vendor.name}</span>
                            {vendor.reason ? (
                              <Badge variant={getCoverageReasonBadgeVariant(vendor.reason)} className="ml-2 align-middle text-[10px] uppercase tracking-wide">
                                {formatCoverageReason(vendor.reason)}
                              </Badge>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {eligibility?.eligible && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Available payment methods are based on vendor-approved options for your cart.
                  </div>
                )}

                <PaymentMethodSelector
                  onSelect={handlePaymentMethodChange}
                  selected={paymentMethod}
                  stripeAvailable={true}
                  mpesaAvailable={mpesaEnabled}
                  availableMethods={allowedCheckoutMethods}
                />

                {!canUseSelectedMethod && (
                  <p className="text-sm text-red-600">Selected payment method is not available for this cart.</p>
                )}

                {/* Payment Forms */}
                <div className="mt-8">
                  {paymentMethod === "pod" ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Your order will be placed immediately and marked as Pay on Delivery.
                      </p>
                      <Button
                        type="button"
                        className="w-full"
                        size="lg"
                        disabled={isLoading || !eligibility?.eligible}
                        onClick={createPodOrder}
                      >
                        {isLoading ? "Placing order..." : "Place Order (Pay on Delivery)"}
                      </Button>
                    </div>
                  ) : paymentMethod === "stripe" && clientSecret ? (
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

                  {paymentMethod === "mpesa" && mpesaEnabled && (
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
              {blockedVendors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-medium">Delivery issues</p>
                  <ul className="mt-2 list-disc pl-5">
                    {blockedVendors.map((vendor) => (
                      <li key={`summary-${vendor.name}-${vendor.reason || "unknown"}`}>
                        <span className="font-medium">{vendor.name}</span>
                        {vendor.reason ? (
                          <Badge variant={getCoverageReasonBadgeVariant(vendor.reason)} className="ml-2 align-middle text-[10px] uppercase tracking-wide">
                            {formatCoverageReason(vendor.reason)}
                          </Badge>
                        ) : null}
                        {Array.isArray(vendor.availableZones) && vendor.availableZones.length > 0 && (
                          <div className="mt-2">
                            <Label htmlFor={`summary-zone-${vendor.vendorId}`} className="text-xs">Choose delivery range</Label>
                            <select
                              id={`summary-zone-${vendor.vendorId}`}
                              className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                              value={selectedVendorZones[vendor.vendorId] || ""}
                              onChange={(event) => handleVendorZoneSelection(vendor.vendorId, event.target.value)}
                            >
                              <option value="">Select a range</option>
                              {vendor.availableZones.map((zone) => (
                                <option key={zone.id} value={zone.id}>
                                  {zone.name}{typeof zone.radiusKm === "number" ? ` (${zone.radiusKm} km)` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {blockedVendors.some((vendor) => (vendor.availableZones || []).length > 0) && (
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void runEligibilityCheck()}>
                      Re-check With Selected Ranges
                    </Button>
                  )}
                </div>
              )}

              {/* Cart Items */}
              <div className="space-y-2">
                {items.map((item) => {
                  const images = typeof item.product.images === 'string'
                    ? JSON.parse(item.product.images || '[]')
                    : item.product.images || [];

                  const price = typeof item.product.price === 'number'
                    ? item.product.price
                    : Number(item.product.price);

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
