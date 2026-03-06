"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type AccessKeyRecord = {
  id: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
};

type AdminLogRecord = {
  id: string;
  email: string;
  ip: string | null;
  success: boolean;
  event: string;
  createdAt: string;
};

export default function AdminSecurityPage() {
  const [isGeneratingBundle, setIsGeneratingBundle] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isGeneratingPassword, setIsGeneratingPassword] = useState(false);
  const [latestLoginUrl, setLatestLoginUrl] = useState<string | null>(null);
  const [latestLoginUrlExpiresAt, setLatestLoginUrlExpiresAt] = useState<string | null>(null);
  const [latestPassword, setLatestPassword] = useState<string | null>(null);
  const [latestPasswordExpiresAt, setLatestPasswordExpiresAt] = useState<string | null>(null);
  const [keys, setKeys] = useState<AccessKeyRecord[]>([]);
  const [logs, setLogs] = useState<AdminLogRecord[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const loadData = useCallback(async () => {
    const [keysRes, logsRes] = await Promise.all([
      fetch("/api/admin/security/access-keys"),
      fetch("/api/admin/security/logs"),
    ]);

    if (keysRes.ok) {
      const payload = await keysRes.json();
      setKeys(payload.keys || []);
    }

    if (logsRes.ok) {
      const payload = await logsRes.json();
      setLogs(payload.logs || []);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeKeyCount = useMemo(
    () => keys.filter((key) => !key.used && new Date(key.expiresAt).getTime() > Date.now()).length,
    [keys]
  );

  const formatCountdown = useCallback((expiresAtIso: string | null) => {
    if (!expiresAtIso) {
      return null;
    }

    const expiresAtMs = new Date(expiresAtIso).getTime();
    const remainingMs = expiresAtMs - now;
    if (remainingMs <= 0) {
      return "Expired";
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [now]);

  const generateLoginLink = async () => {
    setIsGeneratingLink(true);
    try {
      const res = await fetch("/api/admin/generate-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to generate login link");
      }

      setLatestLoginUrl(payload.loginUrl);
  setLatestLoginUrlExpiresAt(payload.expiresAt || null);
      await navigator.clipboard.writeText(payload.loginUrl);
      toast.success("Admin login URL generated and copied.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate login URL");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const generateLoginBundle = async () => {
    setIsGeneratingBundle(true);
    try {
      const res = await fetch("/api/admin/generate-login-bundle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to generate login bundle");
      }

      const expiresAt = payload.expiresAt || null;
      const clipboardValue = `Login URL: ${payload.loginUrl}\nPassword: ${payload.password}\nExpires At: ${expiresAt || "unknown"}`;

      setLatestLoginUrl(payload.loginUrl);
      setLatestLoginUrlExpiresAt(expiresAt);
      setLatestPassword(payload.password);
      setLatestPasswordExpiresAt(expiresAt);
      await navigator.clipboard.writeText(clipboardValue);
      toast.success("Admin login URL and password generated with a shared expiry and copied.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate login bundle");
    } finally {
      setIsGeneratingBundle(false);
    }
  };

  const generatePassword = async () => {
    setIsGeneratingPassword(true);
    try {
      const res = await fetch("/api/admin/generate-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to generate password");
      }

      setLatestPassword(payload.password);
  setLatestPasswordExpiresAt(payload.expiresAt || null);
      await navigator.clipboard.writeText(payload.password);
      toast.success("One-time admin password generated and copied.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate password");
    } finally {
      setIsGeneratingPassword(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    try {
      const res = await fetch("/api/admin/security/access-keys", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyId }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to revoke key");
      }

      toast.success(payload.revoked ? "Access key revoked" : "Key was already invalid");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke key");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Security</h1>
        <p className="text-sm text-muted-foreground">Generate one-time login assets and monitor admin access activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Generate Login Link</CardTitle>
            <CardDescription>Create a secure `/admin/login/&lt;key&gt;` URL, or generate URL + password together.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => void generateLoginBundle()} disabled={isGeneratingBundle}>
              {isGeneratingBundle ? "Generating bundle..." : "Generate Login + Password"}
            </Button>
            <Button onClick={() => void generateLoginLink()} disabled={isGeneratingLink}>
              {isGeneratingLink ? "Generating..." : "Generate Login Link"}
            </Button>
            <p className="text-sm text-muted-foreground">Active keys: {activeKeyCount}</p>
            {latestLoginUrl ? <p className="break-all text-sm">Latest: {latestLoginUrl}</p> : null}
            {latestLoginUrlExpiresAt ? (
              <p className="text-xs text-muted-foreground">
                Latest link expires in {formatCountdown(latestLoginUrlExpiresAt)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generate One-Time Password</CardTitle>
            <CardDescription>Password is valid for a short time and consumed on first login.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => void generatePassword()} disabled={isGeneratingPassword}>
              {isGeneratingPassword ? "Generating..." : "Generate Password"}
            </Button>
            {latestPassword ? <p className="break-all text-sm">Latest: {latestPassword}</p> : null}
            {latestPasswordExpiresAt ? (
              <p className="text-xs text-muted-foreground">
                Latest password expires in {formatCountdown(latestPasswordExpiresAt)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Access Keys</CardTitle>
          <CardDescription>Revoke any key immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {keys.length === 0 ? <p className="text-sm text-muted-foreground">No access keys found.</p> : null}
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="text-sm font-medium">{key.id}</p>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(key.expiresAt).toLocaleString()} | {key.used ? "Used/Revoked" : "Active"}
                </p>
              </div>
              <Button variant="destructive" onClick={() => void revokeKey(key.id)} disabled={key.used}>
                Revoke
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Admin Activity</CardTitle>
          <CardDescription>Login attempts, key generation, password generation, and revocations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? <p className="text-sm text-muted-foreground">No logs found.</p> : null}
          {logs.map((log) => (
            <div key={log.id} className="rounded border p-3 text-sm">
              <p className="font-medium">
                {log.event} - {log.success ? "success" : "failure"}
              </p>
              <p className="text-xs text-muted-foreground">
                {log.email} | {log.ip || "unknown_ip"} | {new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
