"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type UserType = "user" | "vendor";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_LOGIN: "Invalid credentials.",
  VERIFY_EMAIL_REQUIRED: "Please verify your email before signing in.",
  EMAIL_DELIVERY_UNAVAILABLE: "We couldn't send your one-time code. Please try again shortly or use password reset.",
  INVALID_OTP: "Invalid one-time code.",
  OTP_EXPIRED: "Your one-time code expired. Request a new code.",
  OTP_LOCKED: "Too many failed OTP attempts. Please wait and try again.",
  OAUTH_ROLE_CONFLICT: "This email is already used by a vendor account. Use vendor login instead.",
  OAuthSignin: "Google sign-in could not be started. Please try again.",
  OAuthAccountNotLinked: "This email is already registered with password login. Sign in with your password first, then link Google from account settings.",
  OAuthCallback: "Google sign-in could not be completed. Please try again.",
  google: "Google sign-in is temporarily unavailable. Please try again shortly.",
  PASSWORD_CHANGE_REQUIRED: "Password reset required before admin access.",
  unauthorized: "You are not authorized to access that page.",
  CredentialsSignin: "Sign in failed. Check your credentials and try again.",
};

function getAuthErrorMessage(errorCode?: string | null) {
  if (!errorCode) return "Login failed. Please try again.";
  return AUTH_ERROR_MESSAGES[errorCode] || "Login failed. Please check your credentials.";
}

function callbackByType(userType: UserType) {
  if (userType === "vendor") return "/vendors/dashboard";
  return "/";
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeType, setActiveType] = useState<UserType>("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const debouncedEmail = useDebouncedValue(email, 300);
  const [callbackUrl, setCallbackUrl] = useState("/");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("userType");
    const err = params.get("error");

    if (type === "user" || type === "vendor") {
      setActiveType(type);
    }

    if (err) {
      toast.error(getAuthErrorMessage(err));
    }

    const callback = params.get("callbackUrl");
    if (callback) {
      if (callback.startsWith("/") && !callback.startsWith("//")) {
        setCallbackUrl(callback);
      }
    }
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const targetUrl = callbackUrl || callbackByType(activeType);
      const result = await signIn("credentials", {
        email,
        password,
        userType: activeType,
        redirect: false,
        callbackUrl: targetUrl,
      });

      if (result?.error) {
        if (result.error.startsWith("OTP_REQUIRED:")) {
          const challengeId = result.error.split(":")[1] || "";
          const params = new URLSearchParams({
            mode: "verify-login",
            email,
            userType: activeType,
            challengeId,
          });
          router.push(`/auth/otp?${params.toString()}`);
          return;
        }

        if (result.error === "PASSWORD_CHANGE_REQUIRED") {
          const params = new URLSearchParams({ email, reason: "password_change_required" });
          router.push(`/auth/forgot-password?${params.toString()}`);
          return;
        }

        toast.error(getAuthErrorMessage(result.error));
        return;
      }

      toast.success("Login successful!");
      router.push(result?.url || targetUrl);
      router.refresh();
    } catch {
      toast.error("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signIn("google", {
        callbackUrl: callbackUrl || "/",
        redirect: false,
      });

      if (result?.error) {
        toast.error(getAuthErrorMessage(result.error));
        return;
      }

      if (result?.url) {
        router.push(result.url);
        return;
      }

      toast.error("Google sign-in could not be started. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Welcome Back</h1>
          <p className="text-gray-500">Sign in to your account</p>
        </div>

        <div className="mb-4 grid w-full grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          <Button type="button" variant={activeType === "user" ? "default" : "ghost"} onClick={() => setActiveType("user")}>Customer</Button>
          <Button type="button" variant={activeType === "vendor" ? "default" : "ghost"} onClick={() => setActiveType("vendor")}>Vendor</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {activeType === "user" ? "Customer Login" : "Vendor Login"}
            </CardTitle>
            <CardDescription>
              {activeType === "user"
                ? "Sign in to your customer account"
                : "Access your vendor dashboard"}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {email !== debouncedEmail && <p className="text-xs text-muted-foreground">Validating input…</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              {activeType === "user" && (
                <Button type="button" className="w-full" variant="outline" onClick={() => void handleGoogleSignIn()} disabled={isLoading}>
                  Continue with Google
                </Button>
              )}

              <div className="flex w-full flex-col gap-1 text-center text-sm text-gray-500">
                <Link href="/auth/forgot-password" className="text-violet-600 hover:underline">
                  Forgot password?
                </Link>
                <Link href="/auth/otp" className="text-violet-600 hover:underline">
                  Sign in with email OTP
                </Link>
                <Link href="/auth/resend-verification" className="text-violet-600 hover:underline">
                  Resend verification email
                </Link>
              </div>

              {activeType === "user" && (
                <p className="text-center text-sm text-gray-500">
                  Don&apos;t have an account?{" "}
                  <Link href="/auth/register" className="text-violet-600 hover:underline">
                    Sign up
                  </Link>
                </p>
              )}

              {activeType === "vendor" && (
                <p className="text-center text-sm text-gray-500">
                  Don&apos;t have a vendor account?{" "}
                  <Link href="/vendors/register" className="text-violet-600 hover:underline">
                    Register as vendor
                  </Link>
                </p>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
