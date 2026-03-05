"use client";

import { useEffect } from "react";
import { getSession } from "next-auth/react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LoginSuccessPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackUrl = params.get("callbackUrl") || "/account";
    const safeCallback = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/account";

    const finalize = async () => {
      if (status === "authenticated" && session?.user) {
        router.replace(safeCallback);
        return;
      }

      // Only show toast once per login
      const toastKey = "felba_login_success_toast";
      const toastShown = localStorage.getItem(toastKey);
      // 1. Try to get session
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const response = await fetch("/api/auth/session", {
            credentials: "include",
            cache: "no-store",
          });
          if (response.ok) {
            const session = await response.json();
            if (session?.user) {
              if (!toastShown) {
                toast.success(`Successfully logged in as ${session.user.name || session.user.email || "user"}`);
                localStorage.setItem(toastKey, "1");
                setTimeout(() => {
                  localStorage.removeItem(toastKey);
                }, 5000);
              }
              console.log("Session found, redirecting to", safeCallback);
              setTimeout(() => router.replace(safeCallback), 1200);
              return;
            }
          }
        } catch (err) {
          console.warn("Session fetch error", err);
        }
        await sleep(700);
      }

      router.replace(`/auth/login?callbackUrl=${encodeURIComponent(safeCallback)}&error=OAuthCallback`);
    };

    // Force session refresh after OAuth redirect
    void getSession();
    void finalize();
  }, [router, session, status]);

  return (
    <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center text-center">
      <CheckCircle className="w-16 h-16 text-primary mb-4" />
      <h1 className="text-3xl font-bold mb-2">Completing sign in...</h1>
      <p className="text-muted-foreground mb-2 max-w-md mx-auto">Your account is being finalized. Please wait a moment.</p>
    </div>
  );
}
