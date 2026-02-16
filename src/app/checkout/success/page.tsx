"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

// Main component to solve build issue
export default function CheckoutSuccessPage() {
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
          Your order has been confirmed.
        </p>

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
