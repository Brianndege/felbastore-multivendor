"use client";

import { useState } from "react";
import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CheckoutFormProps {
  shippingAddress: any;
  billingAddress: any;
  onSuccess: () => void;
}

export default function CheckoutForm({
  shippingAddress,
  billingAddress,
  onSuccess,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    try {
      // Create order first
      const orderResponse = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress,
          billingAddress,
          paymentMethod: "stripe",
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || "Failed to create order");
      }

      const { order } = await orderResponse.json();

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) {
        toast.error(error.message || "Payment failed");
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        // Update order with payment info
        await fetch(`/api/orders/${order.id}/payment`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            paymentStatus: "paid",
          }),
        });

        toast.success("Payment successful! Order placed.");
        onSuccess();
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <PaymentElement />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || isLoading}
        size="lg"
      >
        {isLoading ? "Processing..." : "Complete Order"}
      </Button>
    </form>
  );
}
