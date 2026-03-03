"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"user" | "vendor">("user");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          Referer: window.location.href,
        },
        body: JSON.stringify({ email, userType }),
      });

      const data = await response.json();
      if (response.status === 429 && data?.requiresCaptcha) {
        toast.error("Too many attempts. Complete CAPTCHA and try again.");
      } else {
        toast.success("If an account exists, we’ve sent a reset link.");
      }
    } catch {
      toast.success("If an account exists, we’ve sent a reset link.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>Enter your email to receive a secure reset link.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <Button type="button" variant={userType === "user" ? "default" : "ghost"} onClick={() => setUserType("user")}>Customer</Button>
              <Button type="button" variant={userType === "vendor" ? "default" : "ghost"} onClick={() => setUserType("vendor")}>Vendor</Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send reset link"}
            </Button>
            <Link href="/auth/login" className="text-sm text-violet-600 hover:underline">Back to sign in</Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
