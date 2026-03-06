"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_ADMIN_LOGIN: "Invalid login credentials or expired key/password.",
  ADMIN_ACCESS_KEY_INVALID: "The admin access link is invalid or expired.",
  ADMIN_PASSWORD_INVALID: "The generated admin password is invalid or expired.",
  ADMIN_EMAIL_NOT_ALLOWED: "This email is not allowed to generate or use admin security credentials.",
  CredentialsSignin: "Login failed. Check email, access link, and generated password.",
};

function getAuthErrorMessage(errorCode?: string | null) {
  if (!errorCode) return "Login failed. Please try again.";
  return AUTH_ERROR_MESSAGES[errorCode] || "Login failed. Please verify your secure access credentials.";
}

export function AdminKeyLoginForm({ accessKey }: { accessKey: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn("admin-secure", {
        redirect: false,
        email,
        password,
        accessKey,
        callbackUrl: "/admin/dashboard",
      });

      if (result?.error) {
        toast.error(getAuthErrorMessage(result.error));
        return;
      }

      toast.success("Secure admin login successful.");
      router.push(result?.url || "/admin/dashboard");
      router.refresh();
    } catch {
      toast.error("Unable to complete admin sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Secure Admin Access</h1>
          <p className="text-gray-500">This login URL and generated password are one-time credentials.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Access is protected by key-based route and one-time password.</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Admin Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Generated Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign in securely"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
