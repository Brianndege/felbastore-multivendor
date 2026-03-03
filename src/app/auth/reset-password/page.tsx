"use client";

import { FormEvent, useMemo, useState } from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const tokenData = useMemo(() => ({
    selector: searchParams?.get("s") || "",
    token: searchParams?.get("t") || "",
    expires: searchParams?.get("e") || "",
    signature: searchParams?.get("sig") || "",
    userType: (searchParams?.get("type") || "user") as "user" | "vendor",
  }), [searchParams]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          Referer: window.location.href,
        },
        body: JSON.stringify({
          ...tokenData,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Unable to reset password.");
        return;
      }

      toast.success("Password reset successfully. Please sign in.");
      router.push("/auth/login");
    } catch {
      toast.error("Unable to reset password right now.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Use a strong password with uppercase, lowercase, number, and symbol.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={12} required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? "Resetting..." : "Reset password"}</Button>
            <Link href="/auth/login" className="text-sm text-violet-600 hover:underline">Back to sign in</Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
