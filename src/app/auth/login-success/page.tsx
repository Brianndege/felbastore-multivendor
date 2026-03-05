"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LoginSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackUrl = params.get("callbackUrl") || "/account";
    const safeCallback = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/account";

    const finalize = async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          const response = await fetch("/api/auth/session", {
            credentials: "include",
            cache: "no-store",
          });

          if (response.ok) {
            const session = await response.json();
            if (session?.user) {
              router.replace(safeCallback);
              return;
            }
          }
        } catch {
        }

        await sleep(300);
      }

      router.replace(`/auth/login?callbackUrl=${encodeURIComponent(safeCallback)}`);
    };

    void finalize();
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center text-center">
      <CheckCircle className="w-16 h-16 text-primary mb-4" />
      <h1 className="text-3xl font-bold mb-2">Completing sign in...</h1>
      <p className="text-muted-foreground mb-2 max-w-md mx-auto">Your account is being finalized. Please wait a moment.</p>
    </div>
  );
}
