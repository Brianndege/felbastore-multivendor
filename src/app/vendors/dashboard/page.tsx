"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function VendorDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [session, status, router]);

  // Fetch functions with safe defaults
  const fetchAnalytics = async () => {
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
  };

  const fetchInventory = async () => {
    try {
      const response = await fetch("/api/vendor/inventory");
      const data = response.ok ? await response.json() : null;
      setInventory(data || getMockInventory());
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setInventory(getMockInventory());
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications");
      const data = response.ok ? await response.json() : [];
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
    }
  };

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
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  if (!session || session.user.role !== "vendor") {
    return null;
  }

  const recentOrders = analytics?.recentOrders || [];
  const products = analytics?.topProducts || [];
  const summary = analytics?.summary || {};
  const revenueData = analytics?.revenue || [];

  const inventoryStats = inventory?.stats || {};
  const inventoryItems = inventory?.inventory || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
          <p className="text-gray-500">
            Welcome back, {session.user.name}! Managing {session.user.storeName || "your store"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/vendors/dashboard/settings">Store Settings</Link>
          </Button>
          <Button asChild>
            <Link href="/vendors/dashboard/products/new">Add New Product</Link>
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

      {/* Tabs: Orders, Products, Inventory, Analytics, Reviews, Notifications */}
      <Tabs defaultValue="orders" className="space-y-4">
        {/* ... Keep your TabsContent as before ... */}
        {/* Just ensure all arrays use optional chaining: recentOrders || [], products || [], inventoryItems || [], notifications || [] */}
      </Tabs>
    </div>
  );
}
