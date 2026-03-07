"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function VendorOrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[VendorOrdersErrorBoundary]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
      <h2 className="text-lg font-semibold">Unable to load vendor orders</h2>
      <p className="mt-2 text-sm">We hit an unexpected error while fetching your orders. Please retry.</p>
      <div className="mt-4">
        <Button type="button" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
