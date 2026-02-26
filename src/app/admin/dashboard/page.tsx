"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type HealthResponse = {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  results?: Record<string, unknown>;
  steps?: Record<string, string>;
  timestamp?: string;
};

export default function AdminDashboardPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [healthKey, setHealthKey] = useState("");
  const [result, setResult] = useState<HealthResponse | null>(null);

  const runDbHealthCheck = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/test-db", {
        method: "POST",
        headers: {
          ...(healthKey ? { "x-db-health-key": healthKey } : {}),
        },
      });

      const data = (await response.json()) as HealthResponse;
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: "Failed to run DB health check.",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const stepEntries = result?.results
    ? Object.entries(result.results).filter(([, value]) => typeof value === "string" && String(value).startsWith("✓"))
    : [];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Run a one-click database write health check for core entities.</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Database Health Check</CardTitle>
          <CardDescription>
            Verifies writes for users, vendors, products, cart, orders, notifications, and inventory alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="health-key">Health Check Key (only needed in production)</Label>
            <Input
              id="health-key"
              type="password"
              placeholder="Optional"
              value={healthKey}
              onChange={(e) => setHealthKey(e.target.value)}
            />
          </div>

          <Button onClick={runDbHealthCheck} disabled={isRunning}>
            {isRunning ? "Running check..." : "Run DB Write Health Check"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>Result</CardTitle>
              <Badge variant={result.success ? "default" : "destructive"}>
                {result.success ? "Passed" : "Failed"}
              </Badge>
            </div>
            <CardDescription>{result.message || result.error || "No message returned."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!!result.details && (
              <div>
                <p className="text-sm font-medium">Details</p>
                <p className="text-sm text-muted-foreground">{result.details}</p>
              </div>
            )}

            {stepEntries.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Completed Steps</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {stepEntries.map(([key, value]) => (
                    <li key={key}>
                      {key}: {String(value)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium">Raw Response</p>
              <pre className="overflow-x-auto rounded-md border p-3 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
