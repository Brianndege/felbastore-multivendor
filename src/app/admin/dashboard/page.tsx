"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type HealthResponse = {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  results?: Record<string, unknown>;
  steps?: Record<string, string>;
  timestamp?: string;
};

type ModerationProduct = {
  id: string;
  name: string;
  description?: string;
  images?: string[];
  price?: string | number;
  currency?: string;
  inventory?: number;
  category: string;
  sku: string | null;
  status: string;
  isApproved: boolean;
  createdAt: string;
  vendorId: string;
  vendor?: {
    id: string;
    name: string;
    storeName: string;
    email: string;
  };
};

type ModerationResponse = {
  products: ModerationProduct[];
  totalCount: number;
  pendingCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type OverviewMetrics = {
  activeVendors: number;
  productsLive: number;
  pendingApprovals: number;
};

type ProductActivity = {
  id: string;
  createdAt: string;
  eventType: string;
  productId: string | null;
  reason: string | null;
  reviewedBy: string | null;
  vendor?: {
    id: string;
    name: string;
    storeName: string;
    email: string;
  };
};

type ActivityResponse = {
  activities: ProductActivity[];
  count: number;
};

type PendingPaymentMethod = {
  id: string;
  methodKind: string;
  label: string;
  approvalStatus: "pending_admin" | "approved" | "rejected";
  isActive: boolean;
  createdAt: string;
  vendor: {
    id: string;
    name: string;
    storeName: string;
    email: string;
  };
};

type AdminLiveEvent = {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

type AdminLiveSnapshot = {
  newUsers: number;
  newVendors: number;
  newOrders: number;
  failedPayments: number;
  flaggedContent: number;
  verificationQueue: number;
  asOf: string;
};

type InventoryScanResult = {
  scannedProducts: number;
  createdAlerts: number;
  skippedAlerts: number;
  vendorsAffected: number;
};

type PersistedInventoryScanState = {
  scannedAt: string;
  result: InventoryScanResult;
};

type PersistedAdminLiveState = {
  events: AdminLiveEvent[];
  snapshot: AdminLiveSnapshot | null;
  lastDisconnectAt: string | null;
  totalReconnectCount: number;
};

const MODERATION_UNREVIEWED_ONLY_STORAGE_KEY = "admin.moderation.showUnreviewedOnly";
const INVENTORY_SCAN_STORAGE_KEY = "admin.inventory.lastScan";
const ADMIN_LIVE_STATE_STORAGE_KEY = "admin.live.state";
const parsedLiveThreshold = Number(process.env.NEXT_PUBLIC_ADMIN_LIVE_UNSTABLE_THRESHOLD || "3");
const LIVE_UNSTABLE_RECONNECT_THRESHOLD =
  Number.isFinite(parsedLiveThreshold) && parsedLiveThreshold >= 1
    ? Math.floor(parsedLiveThreshold)
    : 3;

export default function AdminDashboardPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [healthKey, setHealthKey] = useState("");
  const [result, setResult] = useState<HealthResponse | null>(null);
  const [isLoadingModeration, setIsLoadingModeration] = useState(false);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [moderationError, setModerationError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [products, setProducts] = useState<ModerationProduct[]>([]);
  const [activities, setActivities] = useState<ProductActivity[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics | null>(null);
  const [moderationPage, setModerationPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [isReviewingSelection, setIsReviewingSelection] = useState(false);
  const [showUnreviewedOnly, setShowUnreviewedOnly] = useState(false);
  const [pendingPaymentMethods, setPendingPaymentMethods] = useState<PendingPaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [isReviewingPaymentMethod, setIsReviewingPaymentMethod] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [liveEvents, setLiveEvents] = useState<AdminLiveEvent[]>([]);
  const [liveSnapshot, setLiveSnapshot] = useState<AdminLiveSnapshot | null>(null);
  const [lastLiveDisconnectAt, setLastLiveDisconnectAt] = useState<string | null>(null);
  const [sessionReconnectCount, setSessionReconnectCount] = useState(0);
  const [totalReconnectCount, setTotalReconnectCount] = useState(0);
  const [hasHydratedLiveState, setHasHydratedLiveState] = useState(false);
  const [isRunningInventoryScan, setIsRunningInventoryScan] = useState(false);
  const [inventoryScanError, setInventoryScanError] = useState("");
  const [inventoryScanNotice, setInventoryScanNotice] = useState("");
  const [inventoryScanResult, setInventoryScanResult] = useState<InventoryScanResult | null>(null);
  const [inventoryScanAt, setInventoryScanAt] = useState<string | null>(null);
  const lastDisconnectMarkAtRef = useRef(0);
  const [filters, setFilters] = useState({
    q: "",
    vendorId: "",
    category: "",
    status: "pending",
    startDate: "",
    endDate: "",
  });
  const [moderationSearchInput, setModerationSearchInput] = useState("");
  const debouncedModerationSearch = useDebouncedValue(moderationSearchInput, 300);
  const isSearchDebouncing = moderationSearchInput !== debouncedModerationSearch;

  useEffect(() => {
    setModerationPage(1);
    setFilters((prev) => ({ ...prev, q: debouncedModerationSearch.trim() }));
  }, [debouncedModerationSearch]);

  const moderationQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(moderationPage));
    params.set("pageSize", "20");
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.vendorId.trim()) params.set("vendorId", filters.vendorId.trim());
    if (filters.category.trim()) params.set("category", filters.category.trim());
    if (filters.status.trim()) params.set("status", filters.status.trim());
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    return params.toString();
  }, [filters, moderationPage]);

  const displayedProducts = useMemo(() => {
    if (!showUnreviewedOnly) {
      return products;
    }

    return products.filter((product) => !product.isApproved && product.status === "pending");
  }, [products, showUnreviewedOnly]);

  const selectedProduct = displayedProducts[selectedProductIndex] || null;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODERATION_UNREVIEWED_ONLY_STORAGE_KEY);
      if (stored === "true") {
        setShowUnreviewedOnly(true);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(INVENTORY_SCAN_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as PersistedInventoryScanState;
      if (parsed?.scannedAt && parsed?.result) {
        setInventoryScanAt(parsed.scannedAt);
        setInventoryScanResult(parsed.result);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ADMIN_LIVE_STATE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PersistedAdminLiveState;

        if (Array.isArray(parsed?.events)) {
          setLiveEvents(parsed.events.slice(0, 20));
        }

        if (parsed?.snapshot) {
          setLiveSnapshot(parsed.snapshot);
        }

        if (typeof parsed?.lastDisconnectAt === "string" || parsed?.lastDisconnectAt === null) {
          setLastLiveDisconnectAt(parsed.lastDisconnectAt ?? null);
        }

        if (typeof parsed?.totalReconnectCount === "number" && Number.isFinite(parsed.totalReconnectCount)) {
          setTotalReconnectCount(parsed.totalReconnectCount);
        }
      }
    } catch {
    } finally {
      setHasHydratedLiveState(true);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(MODERATION_UNREVIEWED_ONLY_STORAGE_KEY, String(showUnreviewedOnly));
    } catch {
    }
  }, [showUnreviewedOnly]);

  const loadModerationQueue = useCallback(async () => {
    setIsLoadingModeration(true);
    setModerationError("");

    try {
      const response = await fetch(`/api/admin/products?${moderationQueryString}`);
      const data = (await response.json()) as ModerationResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error || "Failed to load moderation queue" : "Failed to load moderation queue");
      }

      const payload = data as ModerationResponse;
      setProducts(payload.products || []);
      setPendingCount(payload.pendingCount || 0);
      setTotalPages(payload.totalPages || 1);
    } catch (error) {
      setModerationError(error instanceof Error ? error.message : "Failed to load moderation queue");
      setProducts([]);
    } finally {
      setIsLoadingModeration(false);
    }
  }, [moderationQueryString]);

  const loadOverviewMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/overview-metrics");
      if (!response.ok) return;
      const payload = (await response.json()) as OverviewMetrics;
      setOverviewMetrics(payload);
    } catch {
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setIsLoadingActivity(true);
    setActivityError("");

    try {
      const response = await fetch("/api/admin/products/activity?limit=20");
      const data = (await response.json()) as ActivityResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error || "Failed to load product activity" : "Failed to load product activity");
      }

      const payload = data as ActivityResponse;
      setActivities(payload.activities || []);
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : "Failed to load product activity");
      setActivities([]);
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  const getCsrfHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Origin: window.location.origin,
    Referer: window.location.href,
  }), []);

  const loadPendingPaymentMethods = useCallback(async () => {
    setIsLoadingPaymentMethods(true);

    try {
      const response = await fetch("/api/admin/payment-methods/pending");
      const data = (await response.json()) as { methods?: PendingPaymentMethod[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to load payment method requests");
      }

      setPendingPaymentMethods(Array.isArray(data.methods) ? data.methods : []);
    } catch {
      setPendingPaymentMethods([]);
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  }, []);

  const approvePaymentMethod = useCallback(async (id: string) => {
    setIsReviewingPaymentMethod(true);
    try {
      const response = await fetch(`/api/admin/payment-methods/${id}/approve`, {
        method: "POST",
        headers: getCsrfHeaders(),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve payment method");
      }

      await loadPendingPaymentMethods();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to approve payment method");
    } finally {
      setIsReviewingPaymentMethod(false);
    }
  }, [getCsrfHeaders, loadPendingPaymentMethods]);

  const rejectPaymentMethod = useCallback(async (id: string) => {
    const reason = window.prompt("Enter rejection reason:", "") || "";
    if (!reason.trim()) {
      window.alert("Rejection reason is required.");
      return;
    }

    setIsReviewingPaymentMethod(true);
    try {
      const response = await fetch(`/api/admin/payment-methods/${id}/reject`, {
        method: "POST",
        headers: getCsrfHeaders(),
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject payment method");
      }

      await loadPendingPaymentMethods();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to reject payment method");
    } finally {
      setIsReviewingPaymentMethod(false);
    }
  }, [getCsrfHeaders, loadPendingPaymentMethods]);

  const reviewProduct = useCallback(
    async (
      productId: string,
      action: "approve" | "reject",
      options?: {
        advanceSelection?: boolean;
        fromIndex?: number;
      }
    ) => {
      const reason =
        action === "reject"
          ? window.prompt("Enter rejection reason for vendor visibility (required for clarity):", "") || ""
          : "";

      if (action === "reject" && !reason.trim()) {
        window.alert("Rejection reason is required.");
        return;
      }

      setIsReviewingSelection(true);
      try {
        const response = await fetch(`/api/admin/products/${productId}/review`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, reason: reason.trim() || undefined }),
        });

        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error || `Failed to ${action} product`);
        }

        await Promise.all([loadModerationQueue(), loadActivity()]);

        if (options?.advanceSelection) {
          setSelectedProductIndex(Math.max(0, options.fromIndex ?? 0));
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : `Failed to ${action} product`);
      } finally {
        setIsReviewingSelection(false);
      }
    },
    [loadActivity, loadModerationQueue]
  );

  const reviewSelectedAndNext = useCallback(
    async (action: "approve" | "reject") => {
      const product = displayedProducts[selectedProductIndex];
      if (!product) {
        return;
      }

      await reviewProduct(product.id, action, {
        advanceSelection: true,
        fromIndex: selectedProductIndex,
      });
    },
    [displayedProducts, selectedProductIndex, reviewProduct]
  );

  const resetModerationUiPreferences = useCallback(() => {
    setShowUnreviewedOnly(false);
    setSelectedProductIndex(0);

    try {
      window.localStorage.removeItem(MODERATION_UNREVIEWED_ONLY_STORAGE_KEY);
    } catch {
    }
  }, []);

  useEffect(() => {
    void loadModerationQueue();
  }, [loadModerationQueue]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    void loadPendingPaymentMethods();
  }, [loadPendingPaymentMethods]);

  useEffect(() => {
    void loadOverviewMetrics();
  }, [loadOverviewMetrics]);

  const markLiveDisconnect = useCallback((message: string) => {
    const now = Date.now();

    setIsLiveConnected(false);
    setLiveError(message);

    if (now - lastDisconnectMarkAtRef.current < 1500) {
      return;
    }

    lastDisconnectMarkAtRef.current = now;
    setLastLiveDisconnectAt(new Date(now).toISOString());
    setSessionReconnectCount((prev) => prev + 1);
    setTotalReconnectCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/admin/live-feed");

    source.addEventListener("ready", () => {
      setIsLiveConnected(true);
      setLiveError("");
    });

    source.addEventListener("snapshot", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as AdminLiveSnapshot;
        setLiveSnapshot(payload);
      } catch {
      }
    });

    source.addEventListener("events", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          items: AdminLiveEvent[];
          snapshot?: AdminLiveSnapshot;
        };

        if (payload.snapshot) {
          setLiveSnapshot(payload.snapshot);
        }

        if (Array.isArray(payload.items) && payload.items.length > 0) {
          setLiveEvents((prev) => {
            const merged = [...payload.items.reverse(), ...prev];
            const deduped = merged.filter(
              (item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index
            );
            return deduped.slice(0, 20);
          });
        }
      } catch {
      }
    });

    source.addEventListener("error", (event) => {
      const detail = (event as MessageEvent).data;
      markLiveDisconnect(typeof detail === "string" ? detail : "Live feed disconnected");
    });

    source.onerror = () => {
      markLiveDisconnect("Live feed disconnected. Retrying automatically...");
    };

    return () => {
      source.close();
      setIsLiveConnected(false);
    };
  }, [markLiveDisconnect]);

  useEffect(() => {
    if (!inventoryScanNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setInventoryScanNotice("");
    }, 8000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [inventoryScanNotice]);

  useEffect(() => {
    if (!hasHydratedLiveState) {
      return;
    }

    try {
      const payload: PersistedAdminLiveState = {
        events: liveEvents.slice(0, 20),
        snapshot: liveSnapshot,
        lastDisconnectAt: lastLiveDisconnectAt,
        totalReconnectCount,
      };

      window.localStorage.setItem(ADMIN_LIVE_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
    }
  }, [hasHydratedLiveState, liveEvents, liveSnapshot, lastLiveDisconnectAt, totalReconnectCount]);

  useEffect(() => {
    if (displayedProducts.length === 0) {
      setSelectedProductIndex(0);
      return;
    }

    if (selectedProductIndex > displayedProducts.length - 1) {
      setSelectedProductIndex(displayedProducts.length - 1);
    }
  }, [displayedProducts, selectedProductIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName?.toLowerCase();

      if (targetTag === "input" || targetTag === "textarea" || targetTag === "select" || target?.isContentEditable) {
        return;
      }

      if (displayedProducts.length === 0 || isLoadingModeration) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "j") {
        event.preventDefault();
        setSelectedProductIndex((prev) => Math.min(displayedProducts.length - 1, prev + 1));
        return;
      }

      if (key === "k") {
        event.preventDefault();
        setSelectedProductIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key === "s") {
        event.preventDefault();
        setSelectedProductIndex((prev) => Math.min(displayedProducts.length - 1, prev + 1));
        return;
      }

      const activeProduct = displayedProducts[selectedProductIndex];
      if (!activeProduct) {
        return;
      }

      if (key === "a") {
        event.preventDefault();
        void reviewProduct(activeProduct.id, "approve", {
          advanceSelection: true,
          fromIndex: selectedProductIndex,
        });
        return;
      }

      if (key === "r") {
        event.preventDefault();
        void reviewProduct(activeProduct.id, "reject", {
          advanceSelection: true,
          fromIndex: selectedProductIndex,
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [displayedProducts, selectedProductIndex, isLoadingModeration, reviewProduct]);

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

  const runInventoryScan = useCallback(async () => {
    setIsRunningInventoryScan(true);
    setInventoryScanError("");
    setInventoryScanNotice("");

    try {
      const response = await fetch("/api/admin/inventory/scan-alerts", {
        method: "POST",
        headers: getCsrfHeaders(),
        body: JSON.stringify({
          lookbackHours: 24,
          maxProducts: 250,
        }),
      });

      const data = (await response.json()) as { error?: string; code?: string; result?: InventoryScanResult };

      if (!response.ok) {
        if (response.status === 409 && data.code === "SCAN_ALREADY_RUNNING") {
          setInventoryScanError("Inventory scan already in progress. Please wait for the current run to finish.");
          return;
        }

        throw new Error(data.error || "Failed to run inventory scan");
      }

      setInventoryScanResult(data.result || null);
      const scannedAt = new Date().toISOString();
      setInventoryScanAt(scannedAt);

      if (data.result) {
        try {
          window.localStorage.setItem(
            INVENTORY_SCAN_STORAGE_KEY,
            JSON.stringify({
              scannedAt,
              result: data.result,
            } satisfies PersistedInventoryScanState)
          );
        } catch {
        }
      }

      if (data.result) {
        setInventoryScanNotice(
          `Inventory scan complete: ${data.result.createdAlerts} new alerts, ${data.result.skippedAlerts} duplicates skipped.`
        );
      } else {
        setInventoryScanNotice("Inventory scan completed successfully.");
      }
    } catch (error) {
      setInventoryScanError(error instanceof Error ? error.message : "Failed to run inventory scan");
    } finally {
      setIsRunningInventoryScan(false);
    }
  }, [getCsrfHeaders]);

  const clearInventoryScanHistory = useCallback(() => {
    setInventoryScanResult(null);
    setInventoryScanAt(null);
    setInventoryScanNotice("");
    setInventoryScanError("");

    try {
      window.localStorage.removeItem(INVENTORY_SCAN_STORAGE_KEY);
    } catch {
    }
  }, []);

  const clearLiveEventHistory = useCallback(() => {
    setLiveEvents([]);
    setLastLiveDisconnectAt(null);
    setSessionReconnectCount(0);
    setTotalReconnectCount(0);

    try {
      window.localStorage.removeItem(ADMIN_LIVE_STATE_STORAGE_KEY);
    } catch {
    }
  }, []);

  const stepEntries = result?.results
    ? Object.entries(result.results).filter(([, value]) => typeof value === "string" && String(value).startsWith("✓"))
    : [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-4 md:py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Moderate product submissions and run one-click database write health checks.</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active vendors</p>
            <p className="text-2xl font-semibold">{overviewMetrics?.activeVendors ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Products live</p>
            <p className="text-2xl font-semibold">{overviewMetrics?.productsLive ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending approvals</p>
            <p className="text-2xl font-semibold">{overviewMetrics?.pendingApprovals ?? pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Live Platform Monitoring</CardTitle>
              <CardDescription>Real-time stream for signups, orders, payment failures, and verification queue status.</CardDescription>
            </div>
            <div className="mobile-stack flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="touch-target"
                onClick={() => void runInventoryScan()}
                disabled={isRunningInventoryScan}
              >
                {isRunningInventoryScan ? "Scanning..." : "Run Inventory Scan"}
              </Button>
              <Badge variant={isLiveConnected ? "default" : "destructive"}>
                {isLiveConnected ? "Connected" : "Disconnected"}
              </Badge>
              {sessionReconnectCount >= LIVE_UNSTABLE_RECONNECT_THRESHOLD ? (
                <Badge variant="destructive">
                  Unstable Connection
                </Badge>
              ) : null}
            </div>
          </div>
          {lastLiveDisconnectAt ? (
            <p className="text-xs text-muted-foreground">
              Last disconnect: {new Date(lastLiveDisconnectAt).toLocaleString()}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Reconnect incidents — session: {sessionReconnectCount} • persisted total: {totalReconnectCount}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {liveSnapshot ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">New users (24h)</p>
                <p className="text-xl font-semibold">{liveSnapshot.newUsers}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">New vendors (24h)</p>
                <p className="text-xl font-semibold">{liveSnapshot.newVendors}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">New orders (24h)</p>
                <p className="text-xl font-semibold">{liveSnapshot.newOrders}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Failed payments</p>
                <p className="text-xl font-semibold">{liveSnapshot.failedPayments}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Flagged content</p>
                <p className="text-xl font-semibold">{liveSnapshot.flaggedContent}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Verification queue</p>
                <p className="text-xl font-semibold">{liveSnapshot.verificationQueue}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading live metrics...</p>
          )}

          {liveError ? <p className="text-sm text-destructive">{liveError}</p> : null}
          {inventoryScanError ? <p className="text-sm text-destructive">{inventoryScanError}</p> : null}
          {inventoryScanNotice ? <p className="text-sm text-emerald-600">{inventoryScanNotice}</p> : null}

          {inventoryScanResult ? (
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Latest inventory scan result</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearInventoryScanHistory}
                >
                  Clear history
                </Button>
              </div>
              {inventoryScanAt ? (
                <p className="text-xs text-muted-foreground">Scanned at {new Date(inventoryScanAt).toLocaleString()}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Scanned {inventoryScanResult.scannedProducts} products • Created {inventoryScanResult.createdAlerts} alerts •
                Skipped {inventoryScanResult.skippedAlerts} duplicates • Affected {inventoryScanResult.vendorsAffected} vendors
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-medium">Recent live events</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="touch-target"
                onClick={clearLiveEventHistory}
                disabled={liveEvents.length === 0}
              >
                Clear events
              </Button>
            </div>
            {liveEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet. New activity will appear automatically.</p>
            ) : (
              <ul className="space-y-2">
                {liveEvents.map((eventItem) => (
                  <li key={eventItem.id} className="rounded-md border p-2 text-sm">
                    <p className="font-medium">{eventItem.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {eventItem.type} • {new Date(eventItem.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Product Moderation Queue</CardTitle>
              <CardDescription>Review vendor product submissions, approve or reject them, and audit moderation activity.</CardDescription>
            </div>
            <Badge variant={pendingCount > 0 ? "destructive" : "default"}>Pending: {pendingCount}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Shortcuts: <span className="font-semibold">J/K</span> move selection, <span className="font-semibold">S</span> skip,
            <span className="font-semibold"> A</span> approve, <span className="font-semibold">R</span> reject.
            {selectedProduct ? ` Selected: ${selectedProduct.name}` : ""}
          </p>

          <div className="flex flex-wrap items-start gap-2 sm:items-center">
            <Checkbox
              id="show-unreviewed-only"
              checked={showUnreviewedOnly}
              onCheckedChange={(checked) => {
                setSelectedProductIndex(0);
                setShowUnreviewedOnly(Boolean(checked));
              }}
            />
            <Label htmlFor="show-unreviewed-only" className="text-sm font-normal">
              Show only unreviewed on this page ({displayedProducts.length})
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-target"
              onClick={resetModerationUiPreferences}
            >
              Reset UI Preferences
            </Button>
          </div>

          <div className="mobile-stack flex flex-wrap gap-2">
            <Button
              size="sm"
              className="touch-target"
              onClick={() => void reviewSelectedAndNext("approve")}
              disabled={!selectedProduct || isReviewingSelection || isLoadingModeration}
            >
              {isReviewingSelection ? "Processing..." : "Approve Selected & Next"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="touch-target"
              onClick={() => void reviewSelectedAndNext("reject")}
              disabled={!selectedProduct || isReviewingSelection || isLoadingModeration}
            >
              {isReviewingSelection ? "Processing..." : "Reject Selected & Next"}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="moderation-search">Search</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="moderation-search"
                  placeholder="Name, SKU, category, vendor"
                  value={moderationSearchInput}
                  onChange={(e) => {
                    setModerationSearchInput(e.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      const immediate = moderationSearchInput.trim();
                      setModerationPage(1);
                      setFilters((prev) => ({ ...prev, q: immediate }));
                      void loadModerationQueue();
                    }
                  }}
                />
                {moderationSearchInput && (
                  <Button
                    className="touch-target"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setModerationSearchInput("");
                      setModerationPage(1);
                      setFilters((prev) => ({ ...prev, q: "" }));
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {isSearchDebouncing && <p className="text-xs text-muted-foreground">Searching...</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="moderation-vendor">Vendor ID</Label>
              <Input
                id="moderation-vendor"
                placeholder="Optional"
                value={filters.vendorId}
                onChange={(e) => {
                  setModerationPage(1);
                  setFilters((prev) => ({ ...prev, vendorId: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="moderation-category">Category</Label>
              <Input
                id="moderation-category"
                placeholder="Optional"
                value={filters.category}
                onChange={(e) => {
                  setModerationPage(1);
                  setFilters((prev) => ({ ...prev, category: e.target.value }));
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="moderation-status">Status</Label>
              <select
                id="moderation-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filters.status}
                onChange={(e) => {
                  setModerationPage(1);
                  setFilters((prev) => ({ ...prev, status: e.target.value }));
                }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="moderation-start-date">Start Date</Label>
              <Input
                id="moderation-start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setModerationPage(1);
                  setFilters((prev) => ({ ...prev, startDate: e.target.value }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="moderation-end-date">End Date</Label>
              <Input
                id="moderation-end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setModerationPage(1);
                  setFilters((prev) => ({ ...prev, endDate: e.target.value }));
                }}
              />
            </div>

            <div className="mobile-stack flex flex-wrap items-end gap-2">
              <Button className="touch-target" onClick={() => void loadModerationQueue()} disabled={isLoadingModeration}>
                {isLoadingModeration ? "Loading..." : "Apply Filters"}
              </Button>
              <Button
                className="touch-target"
                variant="outline"
                onClick={() => {
                  setModerationPage(1);
                  setModerationSearchInput("");
                  setFilters({
                    q: "",
                    vendorId: "",
                    category: "",
                    status: "pending",
                    startDate: "",
                    endDate: "",
                  });
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          {moderationError && <p className="text-sm text-destructive">{moderationError}</p>}

          <div className="table-scroll rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                      {isLoadingModeration
                        ? "Loading moderation queue..."
                        : showUnreviewedOnly
                          ? "No unreviewed products found on this page."
                          : "No products found for the selected filters."}
                    </td>
                  </tr>
                ) : (
                  displayedProducts.map((product, index) => (
                    <tr
                      key={product.id}
                      className={`border-t cursor-pointer ${selectedProductIndex === index ? "bg-muted/40" : ""}`}
                      onClick={() => setSelectedProductIndex(index)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground">SKU: {product.sku || "N/A"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{product.vendor?.storeName || product.vendor?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{product.vendor?.email || product.vendorId}</div>
                      </td>
                      <td className="px-3 py-2">{product.category}</td>
                      <td className="px-3 py-2">
                        <Badge variant={product.isApproved ? "default" : product.status === "pending" ? "destructive" : "secondary"}>
                          {product.isApproved ? "approved" : product.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(product.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void reviewProduct(product.id, "approve");
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              void reviewProduct(product.id, "reject");
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Selected Product Details</p>
            {!selectedProduct ? (
              <p className="text-xs text-muted-foreground">No product selected.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Name:</span> {selectedProduct.name}</p>
                <p><span className="font-medium">Vendor:</span> {selectedProduct.vendor?.storeName || selectedProduct.vendor?.name || "Unknown"}</p>
                <p><span className="font-medium">Category:</span> {selectedProduct.category}</p>
                <p><span className="font-medium">SKU:</span> {selectedProduct.sku || "N/A"}</p>
                <p><span className="font-medium">Inventory:</span> {selectedProduct.inventory ?? "N/A"}</p>
                <p>
                  <span className="font-medium">Price:</span>{" "}
                  {selectedProduct.price !== undefined
                    ? `${selectedProduct.currency || "KES"} ${selectedProduct.price}`
                    : "N/A"}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Description:</span>{" "}
                  {selectedProduct.description?.trim() || "No description provided."}
                </p>

                {Array.isArray(selectedProduct.images) && selectedProduct.images.length > 0 && (
                  <div>
                    <p className="mb-1 font-medium">Images</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.images.slice(0, 4).map((image, index) => (
                        <img
                          key={`${selectedProduct.id}-image-${index}`}
                          src={image}
                          alt={`${selectedProduct.name} image ${index + 1}`}
                          className="h-16 w-16 rounded border object-cover"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">Page {moderationPage} of {totalPages}</p>
            <div className="mobile-stack flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="touch-target"
                disabled={moderationPage <= 1 || isLoadingModeration}
                onClick={() => setModerationPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="touch-target"
                disabled={moderationPage >= totalPages || isLoadingModeration}
                onClick={() => setModerationPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Vendor Payment Method Approvals</CardTitle>
              <CardDescription>Approve or reject vendor-submitted payment options before they become available in checkout.</CardDescription>
            </div>
            <div className="mobile-stack flex flex-wrap items-center gap-2">
              <Badge variant={pendingPaymentMethods.length > 0 ? "destructive" : "default"}>Pending: {pendingPaymentMethods.length}</Badge>
              <Button className="touch-target" variant="outline" size="sm" onClick={() => void loadPendingPaymentMethods()} disabled={isLoadingPaymentMethods}>
                {isLoadingPaymentMethods ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="table-scroll rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-left">Label</th>
                  <th className="px-3 py-2 text-left">Submitted</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingPaymentMethods.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                      {isLoadingPaymentMethods ? "Loading payment method requests..." : "No pending payment method requests."}
                    </td>
                  </tr>
                ) : (
                  pendingPaymentMethods.map((method) => (
                    <tr key={method.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{method.vendor?.storeName || method.vendor?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{method.vendor?.email || method.vendor?.id}</div>
                      </td>
                      <td className="px-3 py-2">{method.methodKind}</td>
                      <td className="px-3 py-2">{method.label}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(method.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => void approvePaymentMethod(method.id)} disabled={isReviewingPaymentMethod}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void rejectPaymentMethod(method.id)} disabled={isReviewingPaymentMethod}>
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Product Activity Feed</CardTitle>
              <CardDescription>Shows the latest product workflow events across vendor submissions and admin decisions.</CardDescription>
            </div>
            <Button className="touch-target" variant="outline" size="sm" onClick={() => void loadActivity()} disabled={isLoadingActivity}>
              {isLoadingActivity ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activityError && <p className="mb-3 text-sm text-destructive">{activityError}</p>}

          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isLoadingActivity ? "Loading activity..." : "No recent activity found."}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activities.map((entry) => (
                <li key={entry.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{entry.eventType}</span>
                    <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-muted-foreground">
                    Vendor: {entry.vendor?.storeName || entry.vendor?.name || "Unknown"}
                    {entry.productId ? ` · Product: ${entry.productId}` : ""}
                    {entry.reason ? ` · Reason: ${entry.reason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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

          <Button className="touch-target w-full sm:w-auto" onClick={runDbHealthCheck} disabled={isRunning}>
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
