"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  MISSING_CREDENTIALS: "Please enter both email and password.",
  INVALID_USER_TYPE: "Invalid account type selected.",
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

export default function AdminLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");

    if (err) {
      toast.error(getAuthErrorMessage(err));
    }
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const callbackUrl = "/admin/dashboard";
      const result = await signIn("credentials", {
        email,
        password,
        userType: "admin",
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        toast.error(getAuthErrorMessage(result.error));
        return;
      }

      toast.success("Admin login successful!");
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
          <h1 className="text-3xl font-bold">Admin Access</h1>
          <p className="text-gray-500">Sign in with your administrator account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Restricted access. Authorized administrators only.</CardDescription>
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

            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
