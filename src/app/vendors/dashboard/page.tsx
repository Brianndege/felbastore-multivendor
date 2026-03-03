"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type VendorNotification = {
  id: string;
  type?: string | null;
  priority?: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationResponse = {
  notifications: VendorNotification[];
  unreadCount: number;
};

type StoreSettingsForm = {
  storeName: string;
  tagline: string;
  storeDescription: string;
  logoUrl: string;
  bannerUrl: string;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string;
  businessRegNumber: string;
  taxId: string;
  payoutMethod: "MPESA" | "BANK_TRANSFER" | "CARD";
  payoutAccount: string;
  shippingMode: "flat" | "free" | "calculated";
  shippingFee: string;
  processingDays: string;
};

type StoreSettingsErrors = Partial<Record<keyof StoreSettingsForm, string>>;

export default function VendorDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "settings">("overview");

  const [analytics, setAnalytics] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [markingIds, setMarkingIds] = useState<string[]>([]);
  const [notificationSearch, setNotificationSearch] = useState("");
  const debouncedNotificationSearch = useDebouncedValue(notificationSearch, 350);

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsErrors, setSettingsErrors] = useState<StoreSettingsErrors>({});
  const [settings, setSettings] = useState<StoreSettingsForm>({
    storeName: "",
    tagline: "",
    storeDescription: "",
    logoUrl: "",
    bannerUrl: "",
    contactEmail: "",
    contactPhone: "",
    businessAddress: "",
    businessRegNumber: "",
    taxId: "",
    payoutMethod: "MPESA",
    payoutAccount: "",
    shippingMode: "flat",
    shippingFee: "",
    processingDays: "2",
  });
  const initialSettingsRef = useRef<StoreSettingsForm | null>(null);
  const [loading, setLoading] = useState(true);

  const getCsrfHeaders = useCallback(() => {
    return {
      "Content-Type": "application/json",
      Origin: window.location.origin,
      Referer: window.location.href,
    };
  }, []);

  // Fetch functions with safe defaults
  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch("/api/vendor/analytics");
      const data = response.ok ? await response.json() : null;
      setAnalytics(data || getMockAnalytics());
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setAnalytics(getMockAnalytics());
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      const response = await fetch("/api/vendor/inventory");
      const data = response.ok ? await response.json() : null;
      setInventory(data || getMockInventory());
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setInventory(getMockInventory());
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=20");
      const data = response.ok ? ((await response.json()) as NotificationResponse) : null;
      setNotifications(data?.notifications || []);
      setUnreadCount(data?.unreadCount || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const markNotificationRead = useCallback(
    async (id: string) => {
      setMarkingIds((prev) => [...prev, id]);

      try {
        const response = await fetch("/api/notifications", {
          method: "PATCH",
          headers: getCsrfHeaders(),
          body: JSON.stringify({ ids: [id] }),
        });

        if (!response.ok) {
          throw new Error(`Failed to mark notification ${id} as read`);
        }

        setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Error marking notification as read:", error);
      } finally {
        setMarkingIds((prev) => prev.filter((item) => item !== id));
      }
    },
    [getCsrfHeaders]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (unreadCount === 0) return;

    setIsMarkingAllRead(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: getCsrfHeaders(),
        body: JSON.stringify({ markAllRead: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }

      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [getCsrfHeaders, unreadCount]);

  const validateSettings = useCallback((draft: StoreSettingsForm) => {
    const errors: StoreSettingsErrors = {};

    if (!draft.storeName.trim()) errors.storeName = "Store name is required.";
    if (!draft.contactEmail.trim()) errors.contactEmail = "Contact email is required.";
    if (draft.contactEmail && !/^\S+@\S+\.\S+$/.test(draft.contactEmail)) {
      errors.contactEmail = "Enter a valid email address.";
    }
    if (!draft.contactPhone.trim()) errors.contactPhone = "Phone number is required.";
    if (!draft.businessAddress.trim()) errors.businessAddress = "Business address is required.";
    if (!draft.payoutAccount.trim()) errors.payoutAccount = "Payout account details are required.";
    if (!draft.processingDays.trim() || Number(draft.processingDays) < 0) {
      errors.processingDays = "Processing days must be 0 or greater.";
    }
    if (draft.shippingMode === "flat" && (!draft.shippingFee.trim() || Number(draft.shippingFee) < 0)) {
      errors.shippingFee = "Shipping fee is required for flat shipping.";
    }

    return errors;
  }, []);

  const isSettingsDirty = useMemo(() => {
    if (!initialSettingsRef.current) return false;
    return JSON.stringify(initialSettingsRef.current) !== JSON.stringify(settings);
  }, [settings]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/login");
      return;
    }

    if (session.user.role !== "vendor") {
      router.push("/");
      return;
    }

    fetchAnalytics();
    fetchInventory();
    fetchNotifications();
  }, [session, status, router, fetchAnalytics, fetchInventory, fetchNotifications]);

  useEffect(() => {
    if (!session?.user) return;

    const initialValues: StoreSettingsForm = {
      storeName: session.user.storeName || "",
      tagline: "",
      storeDescription: "",
      logoUrl: "",
      bannerUrl: "",
      contactEmail: session.user.email || "",
      contactPhone: "",
      businessAddress: "",
      businessRegNumber: "",
      taxId: "",
      payoutMethod: "MPESA",
      payoutAccount: "",
      shippingMode: "flat",
      shippingFee: "0",
      processingDays: "2",
    };

    setSettings(initialValues);
    initialSettingsRef.current = initialValues;
  }, [session]);

  useEffect(() => {
    if (!isSettingsDirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSettingsDirty]);

  useEffect(() => {
    if (!isSettingsDirty) return;

    const handleDocumentNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;

      const url = new URL(link.href, window.location.origin);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      if (!window.confirm("You have unsaved Store Settings changes. Leave this page?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleDocumentNavigation, true);
    return () => document.removeEventListener("click", handleDocumentNavigation, true);
  }, [isSettingsDirty]);

  // Mock fallback data
  const getMockAnalytics = () => ({
    totalSales: 0,
    orderCount: 0,
    productCount: 0,
    averageRating: 0,
    monthlyGrowth: 0,
    pendingOrders: 0,
    revenue: [
      { month: "Jan", amount: 0 },
      { month: "Feb", amount: 0 },
      { month: "Mar", amount: 0 },
      { month: "Apr", amount: 0 },
      { month: "May", amount: 0 },
      { month: "Jun", amount: 0 },
    ],
    recentOrders: [],
    topProducts: [],
    summary: {},
  });

  const getMockInventory = () => ({
    stats: { outOfStock: 0, lowStock: 0, wellStocked: 0 },
    inventory: [],
  });

  const moderationNotifications = notifications.filter(
    (item) => item.type === "product_moderation" || item.title.toLowerCase().includes("product")
  );

  const filteredModerationNotifications = useMemo(() => {
    const query = debouncedNotificationSearch.trim().toLowerCase();
    if (!query) return moderationNotifications;

    return moderationNotifications.filter((item) =>
      `${item.title} ${item.message}`.toLowerCase().includes(query)
    );
  }, [debouncedNotificationSearch, moderationNotifications]);

  if (status === "loading" || loading) {
    return <div className="container mx-auto px-4 py-4 md:py-8">Loading...</div>;
  }

  if (!session || session.user.role !== "vendor") {
    return null;
  }

  const summary = analytics?.summary || {};
  const revenueData = analytics?.revenue || [];

  const inventoryStats = inventory?.stats || {};

  const saveStoreSettings = async () => {
    const errors = validateSettings(settings);
    setSettingsErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the highlighted Store Settings fields.");
      return;
    }

    setIsSavingSettings(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      initialSettingsRef.current = settings;
      toast.success("Store settings saved successfully.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const updateSettings = <K extends keyof StoreSettingsForm>(field: K, value: StoreSettingsForm[K]) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    if (settingsErrors[field]) {
      setSettingsErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const switchToOverview = () => {
    if (isSettingsDirty && !window.confirm("You have unsaved Store Settings changes. Continue without saving?")) {
      return;
    }
    setActiveTab("overview");
  };

  return (
    <div className="container mx-auto space-y-6 px-4 py-4 md:py-8">
      <Card className="overflow-hidden border-none bg-gradient-to-r from-primary/10 via-background to-background shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {session.user.name}! Managing {session.user.storeName || "your store"}
            </p>
          </div>
          <div className="mobile-stack flex flex-wrap gap-2">
            <Button variant={activeTab === "overview" ? "default" : "outline"} className="touch-target" onClick={switchToOverview}>Overview</Button>
            <Button variant={activeTab === "settings" ? "default" : "outline"} className="touch-target" onClick={() => setActiveTab("settings")}>Store Settings</Button>
            <Button asChild className="touch-target">
              <Link href="/vendors/dashboard/products">Add New Product</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeTab === "overview" ? (
      <>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Overview</h2>
          <p className="text-muted-foreground">
            Your store performance snapshot and moderation activity.
          </p>
        </div>
        <div className="mobile-stack flex flex-wrap gap-3">
          <Button asChild variant="outline" className="touch-target">
            <Link href="/vendors/dashboard">Store Settings</Link>
          </Button>
          <Button asChild className="touch-target">
            <Link href="/vendors/dashboard/products">Add New Product</Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sales</CardDescription>
            <CardTitle className="text-2xl">${summary.totalSales?.toFixed(2) || '0.00'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-500">
              <span className={summary.monthlyGrowth > 0 ? "text-green-500" : "text-red-500"}>
                {summary.monthlyGrowth > 0 ? "↑" : "↓"} {Math.abs(summary.monthlyGrowth || 0).toFixed(1)}%
              </span> from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-2xl">{summary.orderCount || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-500">
              {summary.pendingOrders || 0} orders pending
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Products</CardDescription>
            <CardTitle className="text-2xl">{summary.productCount || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-500">
              {inventoryStats.lowStock || 0} low in stock
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Rating</CardDescription>
            <CardTitle className="text-2xl flex items-center">
              {summary.averageRating?.toFixed(1) || '0.0'}
              <span className="ml-1 text-yellow-400">★</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-500">Based on customer reviews</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>Your sales performance for the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <div className="flex h-[250px] items-end justify-between gap-2">
              {revenueData.map((month: any, i: number) => (
                <div key={month.month} className="flex w-full flex-col items-center">
                  <div
                    className="w-full bg-violet-500"
                    style={{
                      height: `${(month.amount / 2500) * 250}px`,
                      backgroundColor: `hsl(265, ${60 + i * 5}%, 65%)`,
                    }}
                  ></div>
                  <div className="mt-2 text-sm">{month.month}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Moderation Notifications
                <Badge variant={unreadCount > 0 ? "destructive" : "secondary"}>{unreadCount} unread</Badge>
              </CardTitle>
              <CardDescription>Shows admin decisions for your product submissions and any rejection reasons.</CardDescription>
            </div>

            <div className="mobile-stack flex flex-wrap gap-2">
              <div className="relative min-w-[240px] flex-1">
                <Input
                  value={notificationSearch}
                  onChange={(event) => setNotificationSearch(event.target.value)}
                  placeholder="Search notifications"
                  aria-label="Search moderation notifications"
                  className="pr-10"
                />
                {notificationSearch.trim().length > 0 && (
                  <button
                    type="button"
                    className="absolute right-3 top-2 text-xs text-muted-foreground"
                    onClick={() => setNotificationSearch("")}
                    aria-label="Clear notification search"
                  >
                    ✕
                  </button>
                )}
              </div>
              <Button className="touch-target" variant="outline" size="sm" onClick={() => void fetchNotifications()} disabled={notificationsLoading}>
                {notificationsLoading ? "Refreshing..." : "Refresh"}
              </Button>
              <Button className="touch-target" size="sm" onClick={() => void markAllNotificationsRead()} disabled={isMarkingAllRead || unreadCount === 0}>
                {isMarkingAllRead ? "Marking..." : "Mark all as read"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredModerationNotifications.length === 0 ? (
            <p className="text-sm text-gray-500">No moderation notifications yet.</p>
          ) : (
            <ul className="space-y-3">
              {filteredModerationNotifications.map((notification) => (
                <li key={notification.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-sm text-gray-600">{notification.message}</p>
                      <p className="mt-1 text-xs text-gray-500">{new Date(notification.createdAt).toLocaleString()}</p>
                    </div>

                    {!notification.isRead && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void markNotificationRead(notification.id)}
                        disabled={markingIds.includes(notification.id)}
                      >
                        {markingIds.includes(notification.id) ? "Saving..." : "Mark as read"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </>
      ) : (
      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Store Settings</CardTitle>
            <CardDescription>Manage your store profile, payout setup, and shipping preferences.</CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Store Information</CardTitle>
              <CardDescription>Core details customers see on your storefront.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="store-name">Store Name *</Label>
                <Input id="store-name" value={settings.storeName} onChange={(event) => updateSettings("storeName", event.target.value)} aria-invalid={Boolean(settingsErrors.storeName)} />
                {settingsErrors.storeName && <p className="text-xs text-destructive">{settingsErrors.storeName}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="store-tagline">Tagline</Label>
                <Input id="store-tagline" value={settings.tagline} onChange={(event) => updateSettings("tagline", event.target.value)} />
                <p className="text-xs text-muted-foreground">Short one-line brand promise shown near your store name.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="store-description">Store Description</Label>
                <Textarea id="store-description" value={settings.storeDescription} onChange={(event) => updateSettings("storeDescription", event.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Branding</CardTitle>
              <CardDescription>Upload or link store visuals for a stronger brand presence.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="logo-url">Logo URL</Label>
                <Input id="logo-url" value={settings.logoUrl} onChange={(event) => updateSettings("logoUrl", event.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label htmlFor="banner-url">Banner URL</Label>
                <Input id="banner-url" value={settings.bannerUrl} onChange={(event) => updateSettings("bannerUrl", event.target.value)} placeholder="https://..." />
              </div>
              <p className="text-xs text-muted-foreground">Use high-resolution images for crisp storefront previews.</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Contact Details</CardTitle>
              <CardDescription>How customers and support can reach your store.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="contact-email">Contact Email *</Label>
                <Input id="contact-email" value={settings.contactEmail} onChange={(event) => updateSettings("contactEmail", event.target.value)} aria-invalid={Boolean(settingsErrors.contactEmail)} />
                {settingsErrors.contactEmail && <p className="text-xs text-destructive">{settingsErrors.contactEmail}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact-phone">Phone *</Label>
                <Input id="contact-phone" value={settings.contactPhone} onChange={(event) => updateSettings("contactPhone", event.target.value)} aria-invalid={Boolean(settingsErrors.contactPhone)} />
                {settingsErrors.contactPhone && <p className="text-xs text-destructive">{settingsErrors.contactPhone}</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Business Information</CardTitle>
              <CardDescription>Compliance and legal identity information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="business-address">Business Address *</Label>
                <Textarea id="business-address" value={settings.businessAddress} onChange={(event) => updateSettings("businessAddress", event.target.value)} aria-invalid={Boolean(settingsErrors.businessAddress)} />
                {settingsErrors.businessAddress && <p className="text-xs text-destructive">{settingsErrors.businessAddress}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="business-reg">Registration Number</Label>
                <Input id="business-reg" value={settings.businessRegNumber} onChange={(event) => updateSettings("businessRegNumber", event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tax-id">Tax ID</Label>
                <Input id="tax-id" value={settings.taxId} onChange={(event) => updateSettings("taxId", event.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Payments</CardTitle>
              <CardDescription>Configure where payouts should be sent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Payout Method</Label>
                <Select value={settings.payoutMethod} onValueChange={(value) => updateSettings("payoutMethod", value as StoreSettingsForm["payoutMethod"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MPESA">M-Pesa</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="payout-account">Payout Account *</Label>
                <Input id="payout-account" value={settings.payoutAccount} onChange={(event) => updateSettings("payoutAccount", event.target.value)} aria-invalid={Boolean(settingsErrors.payoutAccount)} />
                {settingsErrors.payoutAccount && <p className="text-xs text-destructive">{settingsErrors.payoutAccount}</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Shipping</CardTitle>
              <CardDescription>Delivery rules shown at checkout.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Shipping Mode</Label>
                <Select value={settings.shippingMode} onValueChange={(value) => updateSettings("shippingMode", value as StoreSettingsForm["shippingMode"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat Rate</SelectItem>
                    <SelectItem value="free">Free Shipping</SelectItem>
                    <SelectItem value="calculated">Calculated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="shipping-fee">Shipping Fee (KES)</Label>
                <Input id="shipping-fee" type="number" value={settings.shippingFee} onChange={(event) => updateSettings("shippingFee", event.target.value)} aria-invalid={Boolean(settingsErrors.shippingFee)} disabled={settings.shippingMode !== "flat"} />
                {settingsErrors.shippingFee && <p className="text-xs text-destructive">{settingsErrors.shippingFee}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="processing-days">Processing Days *</Label>
                <Input id="processing-days" type="number" value={settings.processingDays} onChange={(event) => updateSettings("processingDays", event.target.value)} aria-invalid={Boolean(settingsErrors.processingDays)} />
                {settingsErrors.processingDays && <p className="text-xs text-destructive">{settingsErrors.processingDays}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mobile-stack flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            className="touch-target"
            onClick={() => {
              if (initialSettingsRef.current) {
                setSettings(initialSettingsRef.current);
                setSettingsErrors({});
              }
            }}
            disabled={!isSettingsDirty || isSavingSettings}
          >
            Reset Changes
          </Button>
          <Button className="touch-target" onClick={saveStoreSettings} disabled={!isSettingsDirty || isSavingSettings}>
            {isSavingSettings ? "Saving..." : "Save Store Settings"}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
