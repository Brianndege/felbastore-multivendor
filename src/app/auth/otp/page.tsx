"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function OtpLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"user" | "vendor">("user");
  const [challengeId, setChallengeId] = useState("");
  const [mode, setMode] = useState<"default" | "verify-login">("default");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const queryMode = query.get("mode");
    const queryChallengeId = query.get("challengeId");
    const queryEmail = query.get("email");
    const queryType = query.get("userType");

    if (queryEmail) {
      setEmail(queryEmail);
    }

    if (queryType === "user" || queryType === "vendor") {
      setUserType(queryType);
    }

    if (queryMode === "verify-login" && queryChallengeId) {
      setMode("verify-login");
      setChallengeId(queryChallengeId);
      setStep("verify");
      setCooldown(60);
    }
  }, []);

  useEffect(() => {
    if (step !== "verify" || cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [step, cooldown]);

  const callbackUrl = useMemo(() => (userType === "vendor" ? "/vendors/dashboard" : "/"), [userType]);

  const requestOtp = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/request-otp", {
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
        toast.error("Too many OTP requests. Please wait and try again.");
        return;
      }

      setChallengeId(data.challengeId || "");
      setCooldown(data.resendAfterSeconds || 60);
      setStep("verify");
      toast.success("If an account exists, we sent a one-time code.");
    } catch {
      toast.success("If an account exists, we sent a one-time code.");
    } finally {
      setIsLoading(false);
    }
  };

  const onRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await requestOtp();
  };

  const onVerifySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challengeId || code.length !== 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn("otp", {
        redirect: false,
        email,
        userType,
        challengeId,
        code,
        callbackUrl,
      });

      if (result?.error) {
        if (result.error === "OTP_EXPIRED") {
          toast.error("OTP expired. Request a new code.");
          return;
        }

        if (result.error === "OTP_LOCKED") {
          toast.error("Too many failed attempts. Please wait before retrying.");
          return;
        }

        if (result.error === "OTP_RATE_LIMITED") {
          toast.error("Too many verification attempts. Please wait and try again.");
          return;
        }

        if (result.error === "OTP_CHALLENGE_MISMATCH") {
          toast.error("This code is no longer valid for the current session. Request a new code.");
          return;
        }

        if (result.error === "OTP_ACCOUNT_NOT_FOUND") {
          toast.error("No matching account was found for this code. Request a new code.");
          return;
        }

        if (result.error === "INVALID_OTP") {
          toast.error("The code is invalid for this session. Use the latest code or request a new one.");
          return;
        }

        if (result.error === "CredentialsSignin") {
          toast.error("Verification failed. Request a new code and try the latest one.");
          return;
        }

        toast.error(`Verification failed (${result.error}). Request a new code and try again.`);
        return;
      }

      if (mode === "verify-login") {
        toast.success("Email verified and sign-in completed.");
      }

      toast.success("Signed in successfully.");
      router.push(result?.url || callbackUrl);
      router.refresh();
    } catch {
      toast.error("Unable to verify OTP right now.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email OTP Sign In</CardTitle>
          <CardDescription>
            {step === "request" ? "Get a one-time code sent to your email." : "Enter the 6-digit code from your email."}
          </CardDescription>
        </CardHeader>

        {step === "request" ? (
          <form onSubmit={onRequestSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                <Button type="button" variant={userType === "user" ? "default" : "ghost"} onClick={() => setUserType("user")}>Customer</Button>
                <Button type="button" variant={userType === "vendor" ? "default" : "ghost"} onClick={() => setUserType("vendor")}>Vendor</Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-label="Email address" required />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? "Sending..." : "Send code"}</Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={onVerifySubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                    setCode(pasted);
                    event.preventDefault();
                  }}
                  aria-label="One-time password"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">Resend available in {cooldown}s</p>
              <Button type="button" variant="outline" className="w-full" onClick={() => void requestOtp()} disabled={cooldown > 0 || isLoading}>
                Resend code
              </Button>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? "Verifying..." : "Verify code"}</Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
