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

type UserType = "user" | "vendor" | "admin";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  MISSING_CREDENTIALS: "Please enter both email and password.",
  INVALID_USER_TYPE: "Invalid account type selected.",
  USER_NOT_FOUND: "No customer account found with this email.",
  VENDOR_NOT_FOUND: "No vendor account found with this email.",
  ADMIN_NOT_FOUND: "No admin account found with this email.",
  PASSWORD_NOT_SET: "Password login is not available for this account.",
  INVALID_PASSWORD: "Incorrect password.",
  ADMIN_ACCESS_DENIED: "This account is not authorized for admin login.",
  USER_ROLE_MISMATCH: "Use the correct account type to sign in.",
  unauthorized: "You are not authorized to access that page.",
  CredentialsSignin: "Invalid email/password combination.",
};

function getAuthErrorMessage(errorCode?: string | null) {
  if (!errorCode) return "Login failed. Please try again.";
  return AUTH_ERROR_MESSAGES[errorCode] || "Login failed. Please check your credentials.";
}

function callbackByType(userType: UserType) {
  if (userType === "vendor") return "/vendors/dashboard";
  if (userType === "admin") return "/admin/dashboard";
  return "/";
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeType, setActiveType] = useState<UserType>("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("userType");
    const err = params.get("error");

    if (type === "user" || type === "vendor" || type === "admin") {
      setActiveType(type);
    }

    if (err) {
      toast.error(getAuthErrorMessage(err));
    }
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const callbackUrl = callbackByType(activeType);
      const result = await signIn("credentials", {
        email,
        password,
        userType: activeType,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        toast.error(getAuthErrorMessage(result.error));
        return;
      }

      toast.success("Login successful!");
      router.push(result?.url || callbackUrl);
      router.refresh();
    } catch {
      toast.error("An error occurred during login");
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

        <div className="mb-4 grid w-full grid-cols-3 gap-2 rounded-lg bg-muted p-1">
          <Button type="button" variant={activeType === "user" ? "default" : "ghost"} onClick={() => setActiveType("user")}>Customer</Button>
          <Button type="button" variant={activeType === "vendor" ? "default" : "ghost"} onClick={() => setActiveType("vendor")}>Vendor</Button>
          <Button type="button" variant={activeType === "admin" ? "default" : "ghost"} onClick={() => setActiveType("admin")}>Admin</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {activeType === "user" ? "Customer Login" : activeType === "vendor" ? "Vendor Login" : "Admin Login"}
            </CardTitle>
            <CardDescription>
              {activeType === "user"
                ? "Sign in to your customer account"
                : activeType === "vendor"
                ? "Access your vendor dashboard"
                : "Sign in with an administrator account"}
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
