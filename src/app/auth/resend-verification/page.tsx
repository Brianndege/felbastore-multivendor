"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"user" | "vendor">("user");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          Referer: window.location.href,
        },
        body: JSON.stringify({ email, userType }),
      });
      toast.success("If your account requires verification, a new link was sent.");
    } catch {
      toast.success("If your account requires verification, a new link was sent.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Resend verification email</CardTitle>
          <CardDescription>Request a fresh verification link.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <Button type="button" variant={userType === "user" ? "default" : "ghost"} onClick={() => setUserType("user")}>Customer</Button>
              <Button type="button" variant={userType === "vendor" ? "default" : "ghost"} onClick={() => setUserType("vendor")}>Vendor</Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? "Sending..." : "Resend verification"}</Button>
            <Link href="/auth/login" className="text-sm text-violet-600 hover:underline">Back to sign in</Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
