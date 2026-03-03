"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RoleChoice = "buyer" | "vendor" | "both";
type PayoutChoice = "MPESA" | "BANK_TRANSFER" | "CARD";

type PreviewProfile = {
  email: string;
  name: string;
  picture: string | null;
};

export default function GoogleOnboardingPage() {
  const [token, setToken] = useState("");
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [profile, setProfile] = useState<PreviewProfile | null>(null);
  const [role, setRole] = useState<RoleChoice>("buyer");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [businessInfo, setBusinessInfo] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutChoice>("MPESA");
  const [payoutAccount, setPayoutAccount] = useState("");

  const requiresVendorFields = role === "vendor" || role === "both";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
    setIsTokenReady(true);
  }, []);

  useEffect(() => {
    if (!isTokenReady) {
      return;
    }

    if (!token) {
      setIsPreviewLoading(false);
      toast.error("Google onboarding link is missing.");
      return;
    }

    const loadPreview = async () => {
      try {
        const response = await fetch(`/api/auth/google-onboarding?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        if (!response.ok) {
          toast.error("Google onboarding link is invalid or expired.");
          return;
        }

        setProfile(data.profile);
      } catch {
        toast.error("Unable to validate onboarding token.");
      } finally {
        setIsPreviewLoading(false);
      }
    };

    void loadPreview();
  }, [isTokenReady, token]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      toast.error("Missing onboarding token.");
      return;
    }

    if (!acceptTerms) {
      toast.error("You must accept the terms to continue.");
      return;
    }

    if (requiresVendorFields) {
      if (!storeName.trim() || !storeSlug.trim() || !payoutAccount.trim()) {
        toast.error("Complete all required vendor onboarding fields.");
        return;
      }

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(storeSlug.trim().toLowerCase())) {
        toast.error("Store slug can only use lowercase letters, numbers, and hyphens.");
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/google-onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          role,
          acceptTerms,
          storeName: storeName.trim() || undefined,
          storeSlug: storeSlug.trim().toLowerCase() || undefined,
          businessInfo: businessInfo.trim() || undefined,
          payoutMethod,
          payoutAccount: payoutAccount.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Unable to complete onboarding.");
        return;
      }

      toast.success("Onboarding complete. Continuing with Google sign in...");
      await signIn("google", { callbackUrl: data.redirectUrl || "/" });
    } catch {
      toast.error("Unable to complete onboarding.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Complete Google sign-in setup</CardTitle>
          <CardDescription>
            Finish your marketplace profile before continuing.
          </CardDescription>
        </CardHeader>

        {isPreviewLoading ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">Validating Google session...</p>
          </CardContent>
        ) : !profile ? (
          <CardContent>
            <p className="text-sm text-red-500">This onboarding link is invalid or expired.</p>
            <div className="mt-4">
              <Link href="/auth/login" className="text-violet-600 hover:underline">
                Return to login
              </Link>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={onSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={profile.name} readOnly />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile.email} readOnly />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Account role</Label>
                <select
                  id="role"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={role}
                  onChange={(event) => setRole(event.target.value as RoleChoice)}
                >
                  <option value="buyer">Buyer</option>
                  <option value="vendor">Vendor</option>
                  <option value="both">Both</option>
                </select>
              </div>

              {requiresVendorFields && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="storeName">Store name</Label>
                    <Input id="storeName" value={storeName} onChange={(event) => setStoreName(event.target.value)} required={requiresVendorFields} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeSlug">Store slug</Label>
                    <Input id="storeSlug" value={storeSlug} onChange={(event) => setStoreSlug(event.target.value)} placeholder="my-store" required={requiresVendorFields} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessInfo">Business info</Label>
                    <Textarea id="businessInfo" value={businessInfo} onChange={(event) => setBusinessInfo(event.target.value)} placeholder="Business details for onboarding" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payoutMethod">Payout method</Label>
                    <select
                      id="payoutMethod"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={payoutMethod}
                      onChange={(event) => setPayoutMethod(event.target.value as PayoutChoice)}
                    >
                      <option value="MPESA">MPESA</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payoutAccount">Payout account</Label>
                    <Input id="payoutAccount" value={payoutAccount} onChange={(event) => setPayoutAccount(event.target.value)} required={requiresVendorFields} />
                  </div>
                </>
              )}

              <div className="flex items-start gap-2">
                <input
                  id="acceptTerms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(event) => setAcceptTerms(event.target.checked)}
                  className="mt-1"
                />
                <Label htmlFor="acceptTerms" className="text-sm font-normal">
                  I accept the <Link href="/terms" className="text-violet-600 hover:underline">Terms</Link> and <Link href="/privacy" className="text-violet-600 hover:underline">Privacy Policy</Link>.
                </Label>
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Saving..." : "Complete and continue"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
