"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function VendorDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [markingIds, setMarkingIds] = useState<string[]>([]);
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

  if (status === "loading" || loading) {
    return <div className="container mx-auto px-4 py-4 md:py-8">Loading...</div>;
  }

  if (!session || session.user.role !== "vendor") {
    return null;
  }

  const summary = analytics?.summary || {};
  const revenueData = analytics?.revenue || [];

  const inventoryStats = inventory?.stats || {};

  const moderationNotifications = notifications.filter(
    (item) => item.type === "product_moderation" || item.title.toLowerCase().includes("product")
  );

  return (
    <div className="container mx-auto px-4 py-4 md:py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
          <p className="text-gray-500">
            Welcome back, {session.user.name}! Managing {session.user.storeName || "your store"}
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
          {moderationNotifications.length === 0 ? (
            <p className="text-sm text-gray-500">No moderation notifications yet.</p>
          ) : (
            <ul className="space-y-3">
              {moderationNotifications.map((notification) => (
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
    </div>
  );
}
