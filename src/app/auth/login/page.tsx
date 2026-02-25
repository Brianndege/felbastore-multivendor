"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"user" | "vendor">("user");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const autoLoginAttempted = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const attemptLogin = async (
    email: string,
    password: string,
    userType: "user" | "vendor"
  ) => {
    const callbackUrl = userType === "vendor" ? "/vendors/dashboard" : "/";
    const result = await signIn("credentials", {
      email,
      password,
      userType,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      return { ok: false, callbackUrl };
    }

    return {
      ok: true,
      callbackUrl,
      url: result?.url,
    };
  };

  useEffect(() => {
    const email = searchParams.get("email") || "";
    const password = searchParams.get("password") || "";
    const userTypeParam = searchParams.get("userType");

    if (email) {
      setEmailInput(email);
    }

    if (password) {
      setPasswordInput(password);
    }

    if (!email || !password || autoLoginAttempted.current) {
      return;
    }

    autoLoginAttempted.current = true;

    const runAutoLogin = async () => {
      setIsLoading(true);
      try {
        if (userTypeParam === "vendor" || userTypeParam === "user") {
          setActiveTab(userTypeParam);
          const directResult = await attemptLogin(email, password, userTypeParam);
          if (directResult.ok) {
            router.push(directResult.url || directResult.callbackUrl);
            router.refresh();
            return;
          }
        } else {
          const userResult = await attemptLogin(email, password, "user");
          if (userResult.ok) {
            router.push(userResult.url || userResult.callbackUrl);
            router.refresh();
            return;
          }

          const vendorResult = await attemptLogin(email, password, "vendor");
          if (vendorResult.ok) {
            setActiveTab("vendor");
            router.push(vendorResult.url || vendorResult.callbackUrl);
            router.refresh();
            return;
          }
        }

        toast.error("Invalid credentials");
      } catch (error) {
        toast.error("An error occurred during login");
      } finally {
        setIsLoading(false);
      }
    };

    runAutoLogin();
  }, [router, searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>, userType: "user" | "vendor") => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await attemptLogin(email, password, userType);

      if (!result.ok) {
        toast.error("Invalid credentials");
      } else {
        toast.success("Login successful!");
        if (result.url) {
          router.push(result.url);
        } else {
          router.push(result.callbackUrl);
        }
        router.refresh();
      }
    } catch (error) {
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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "user" | "vendor")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="user">Customer</TabsTrigger>
            <TabsTrigger value="vendor">Vendor</TabsTrigger>
          </TabsList>

          <TabsContent value="user">
            <Card>
              <CardHeader>
                <CardTitle>Customer Login</CardTitle>
                <CardDescription>
                  Sign in to your customer account to continue shopping
                </CardDescription>
              </CardHeader>
              <form onSubmit={(e) => handleLogin(e, "user")}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email</Label>
                    <Input
                      id="user-email"
                      name="email"
                      type="email"
                      placeholder="john@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-password">Password</Label>
                    <Input
                      id="user-password"
                      name="password"
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                  <p className="text-center text-sm text-gray-500">
                    Don't have an account?{" "}
                    <Link href="/auth/register" className="text-violet-600 hover:underline">
                      Sign up
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="vendor">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Login</CardTitle>
                <CardDescription>
                  Access your vendor dashboard to manage your store
                </CardDescription>
              </CardHeader>
              <form onSubmit={(e) => handleLogin(e, "vendor")}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor-email">Email</Label>
                    <Input
                      id="vendor-email"
                      name="email"
                      type="email"
                      placeholder="vendor@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-password">Password</Label>
                    <Input
                      id="vendor-password"
                      name="password"
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                  <p className="text-center text-sm text-gray-500">
                    Don't have a vendor account?{" "}
                    <Link href="/vendors/register" className="text-violet-600 hover:underline">
                      Register as vendor
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
