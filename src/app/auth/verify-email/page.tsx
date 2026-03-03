"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  const payload = useMemo(() => ({
    selector: searchParams?.get("s") || "",
    token: searchParams?.get("t") || "",
    expires: searchParams?.get("e") || "",
    signature: searchParams?.get("sig") || "",
    userType: (searchParams?.get("type") || "user") as "user" | "vendor",
  }), [searchParams]);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: window.location.origin,
            Referer: window.location.href,
          },
          body: JSON.stringify(payload),
        });

        if (!active) return;
        setStatus(response.ok ? "success" : "error");
      } catch {
        if (!active) return;
        setStatus("error");
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [payload]);

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email verification</CardTitle>
          <CardDescription>
            {status === "loading" && "Verifying your email..."}
            {status === "success" && "Your email is verified. You can now sign in."}
            {status === "error" && "This verification link is invalid or expired."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/auth/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
