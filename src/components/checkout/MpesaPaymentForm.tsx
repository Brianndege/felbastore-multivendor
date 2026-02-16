import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface MpesaPaymentFormProps {
  shippingAddress: any;
  billingAddress: any;
  onSuccess: () => void;
  orderId: string;
}

export default function MpesaPaymentForm({
  shippingAddress,
  billingAddress,
  onSuccess,
  orderId,
}: MpesaPaymentFormProps) {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState("");
  const [stage, setStage] = useState<"input" | "pending" | "complete">("input");
  const [timer, setTimer] = useState(60);

  // Format phone number to Safaricom format (254XXXXXXXXX)
  const formatPhoneNumber = (input: string): string => {
    // Remove all non-digit characters
    let digits = input.replace(/\D/g, "");

    // If starts with 0, replace with 254
    if (digits.startsWith("0")) {
      digits = "254" + digits.substring(1);
    }

    // If starts with 7, add 254 prefix
    if (digits.startsWith("7") && digits.length === 9) {
      digits = "254" + digits;
    }

    return digits;
  };

  // Handle phone input change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value);
  };

  // Initialize payment with M-Pesa
  const initiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Format and validate the phone number
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone.match(/^254\d{9}$/)) {
      toast.error("Please enter a valid Safaricom number (starting with 07XX or 254)");
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
          paymentMethod: "mpesa",
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || "Failed to create order");
      }

      const { order } = await orderResponse.json();

      // Initiate M-Pesa payment
      const paymentResponse = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          paymentMethod: "mpesa",
          phone: formattedPhone,
          returnUrl: window.location.origin + "/orders",
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.error || "Failed to initiate M-Pesa payment");
      }

      const paymentData = await paymentResponse.json();

      if (paymentData.success) {
        // Store the checkout request ID for status checks
        setCheckoutRequestId(paymentData.paymentId);
        setStage("pending");
        toast.success("STK Push sent to your phone. Please check your phone to complete payment.");

        // Start the timer
        setTimer(60);
      } else {
        toast.error(paymentData.error || "Failed to initiate payment");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error instanceof Error ? error.message : "Payment initiation failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Check payment status
  const checkPaymentStatus = async () => {
    if (!checkoutRequestId) return;

    try {
      const response = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: checkoutRequestId,
          paymentMethod: "mpesa",
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.status === "SUCCESS") {
          toast.success("Payment successful! Order confirmed.");
          setStage("complete");
          onSuccess();
        } else if (data.status === "FAILED") {
          toast.error("Payment failed. Please try again.");
          setStage("input"); // Allow retrying
        }
        // If still pending, continue waiting
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
    }
  };

  // Timer effect for checking payment status
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (stage === "pending") {
      // Check immediately
      checkPaymentStatus();

      // Then set up interval
      intervalId = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(intervalId);
            return 0;
          }
          return prev - 1;
        });

        checkPaymentStatus();
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [stage, checkoutRequestId]);

  // Timer display effect
  useEffect(() => {
    if (timer === 0 && stage === "pending") {
      toast.info("Payment verification timed out. If you completed the payment, check your orders page.");
    }
  }, [timer, stage]);

  if (stage === "pending") {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto rounded-full bg-yellow-100 p-6 text-yellow-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold">Check Your Phone</h3>
          <p className="text-gray-600 mt-2">
            An STK push has been sent to your phone. Please enter your M-Pesa PIN to complete the payment.
          </p>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertTitle>Verifying payment status...</AlertTitle>
          <AlertDescription>
            Waiting for confirmation: {timer} seconds remaining
          </AlertDescription>
        </Alert>

        <div className="flex justify-center gap-4 mt-6">
          <Button variant="outline" onClick={() => setStage("input")}>
            Try Again
          </Button>
          <Button onClick={checkPaymentStatus}>
            Check Status
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "complete") {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto rounded-full bg-green-100 p-6 text-green-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold">Payment Successful!</h3>
          <p className="text-gray-600 mt-2">
            Your order has been confirmed and is being processed.
          </p>
        </div>

        <Button onClick={onSuccess}>
          View My Orders
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={initiatePayment} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="phone">M-Pesa Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="07XX XXX XXX or 254XXXXXXXXX"
          value={phone}
          onChange={handlePhoneChange}
          required
        />
        <p className="text-xs text-gray-500">
          Enter the phone number registered with M-Pesa. We'll send a payment request to this number.
        </p>
      </div>

      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertTitle>How M-Pesa Payment Works</AlertTitle>
        <AlertDescription>
          1. Enter your M-Pesa registered phone number<br />
          2. You'll receive an STK push notification on your phone<br />
          3. Enter your M-Pesa PIN to confirm payment<br />
          4. Wait for confirmation (this usually takes a few seconds)
        </AlertDescription>
      </Alert>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
        size="lg"
      >
        {isLoading ? "Processing..." : "Pay with M-Pesa"}
      </Button>
    </form>
  );
}
