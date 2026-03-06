"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function AdminSessionGuard() {
  const { data: session } = useSession();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (session?.user?.role !== "admin") {
      return;
    }

    const closeSessionOnTabClose = () => {
      const body = new Blob([JSON.stringify({ reason: "tab_closed" })], { type: "application/json" });
      navigator.sendBeacon("/api/admin/session/close", body);
    };

    const expireOnIdle = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = setTimeout(() => {
        void signOut({ callbackUrl: "/" });
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents: Array<keyof WindowEventMap> = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, expireOnIdle, { passive: true });
    }

    window.addEventListener("beforeunload", closeSessionOnTabClose);
    expireOnIdle();

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, expireOnIdle);
      }

      window.removeEventListener("beforeunload", closeSessionOnTabClose);
    };
  }, [session?.user?.role]);

  return null;
}
