"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateOrderStatus } from "./lifecycle-actions";

type VendorConfirmOrderButtonProps = {
  orderId: string;
  currentStatus: string;
  canUpdateStatus: boolean;
};

export default function VendorConfirmOrderButton({
  orderId,
  currentStatus,
  canUpdateStatus,
}: VendorConfirmOrderButtonProps) {
  const [status, setStatus] = useState(currentStatus.toLowerCase());
  const [isPending, startTransition] = useTransition();

  const canConfirm = canUpdateStatus && status === "pending";

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={!canConfirm || isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await updateOrderStatus({
              orderId,
              status: "CONFIRMED",
              note: "Vendor confirmed order from dashboard",
            });
            setStatus("confirmed");
            toast.success("Order confirmed");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to confirm order");
          }
        });
      }}
    >
      {isPending ? "Confirming..." : status === "confirmed" ? "Confirmed" : "Confirm Order"}
    </Button>
  );
}
