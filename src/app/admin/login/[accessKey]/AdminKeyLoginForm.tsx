"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_ADMIN_LOGIN: "Invalid login credentials or expired key/password.",
  ADMIN_LOGIN_RATE_LIMITED: "Too many login attempts. Wait 15 minutes, then generate a fresh login bundle and try once.",
  ADMIN_ACCESS_KEY_INVALID: "The admin access link is invalid or expired.",
  ADMIN_PASSWORD_INVALID: "The generated admin password is invalid or expired.",
  ADMIN_EMAIL_NOT_ALLOWED: "This email is not allowed to generate or use admin security credentials.",
  CredentialsSignin: "Login failed. Check email, access link, and generated password.",
};

function getAuthErrorMessage(errorCode?: string | null) {
  if (!errorCode) return "Login failed. Please try again.";
  return AUTH_ERROR_MESSAGES[errorCode] || "Login failed. Please verify your secure access credentials.";
}

function formatCountdown(msRemaining: number) {
  if (msRemaining <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.floor(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AdminKeyLoginForm({ accessKey, accessKeyExpiresAt }: { accessKey: string; accessKeyExpiresAt: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const expiresAtTs = useMemo(() => new Date(accessKeyExpiresAt).getTime(), [accessKeyExpiresAt]);
  const msRemaining = expiresAtTs - now;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (msRemaining <= 0) {
      toast.error("This admin access link has expired. Generate a new login link and password.");
      return;
    }

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
          <p className="mt-2 text-sm text-gray-500">
            Access link expires in <span className={msRemaining <= 0 ? "font-semibold text-red-600" : "font-semibold"}>{formatCountdown(msRemaining)}</span>
          </p>
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
