"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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

  const fetchAnalytics = async () => {
    try {
      const response = await fetch("/api/vendor/analytics");
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        console.error("Failed to fetch analytics");
        setAnalytics(getMockAnalytics());
      }
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
      if (response.ok) {
        const data = await response.json();
        setInventory(data);
      } else {
        console.error("Failed to fetch inventory");
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications");
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      } else {
        console.error("Failed to fetch notifications");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const getMockAnalytics = () => ({
    totalSales: 12495.75,
    orderCount: 178,
    productCount: 24,
    averageRating: 4.7,
    monthlyChange: 8.3,
    pendingOrders: 5,
    revenue: [
      { month: "Jan", amount: 1200 },
      { month: "Feb", amount: 1800 },
      { month: "Mar", amount: 1600 },
      { month: "Apr", amount: 2100 },
      { month: "May", amount: 1900 },
      { month: "Jun", amount: 2400 },
    ],
    recentOrders: [],
    products: []
  });

  if (status === "loading" || loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  if (!session || session.user.role !== "vendor") {
    return null;
  }

  if (!analytics) {
    return <div className="container mx-auto px-4 py-8">Error loading dashboard data.</div>;
  }

  const recentOrders = analytics.recentOrders || [];
  const products = analytics.topProducts || [];
  const summary = analytics.summary || {};

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
              {analytics.inventory?.lowStock || 0} low in stock
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
            <div className="text-xs text-gray-500">
              Based on customer reviews
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>Your sales performance for the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <div className="flex h-[250px] items-end justify-between gap-2">
              {analytics.revenue.map((month: any, i: number) => (
                <div key={month.month} className="flex w-full flex-col items-center">
                  <div
                    className="w-full bg-violet-500"
                    style={{
                      height: `${(month.amount / 2500) * 250}px`,
                      backgroundColor: `hsl(265, ${60 + (i * 5)}%, 65%)`
                    }}
                  ></div>
                  <div className="mt-2 text-sm">{month.month}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex justify-between">
            <h2 className="text-xl font-semibold">Recent Orders</h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/vendors/dashboard/orders">View All Orders</Link>
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell>{order.items}</TableCell>
                    <TableCell>${order.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.status === "Delivered"
                            ? "default"
                            : order.status === "Shipped"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between">
            <h2 className="text-xl font-semibold">Your Products</h2>
            <div className="space-x-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/vendors/dashboard/products">Manage All Products</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/vendors/dashboard/products/new">Add New Product</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Inventory</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product: any) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.id}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>${product.price.toFixed(2)}</TableCell>
                    <TableCell>{product.inventory}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.status === "Active"
                            ? "default"
                            : product.status === "Low Stock"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="mr-2">Edit</Button>
                      <Button variant="ghost" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Analytics</CardTitle>
              <CardDescription>
                Comprehensive analytics for your store performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-gray-500">
                  Advanced analytics features would be displayed here, including:
                </p>
                <ul className="mt-4 space-y-2 text-left max-w-md mx-auto">
                  <li>• Customer demographics and behavior</li>
                  <li>• Traffic sources and conversion rates</li>
                  <li>• Product performance metrics</li>
                  <li>• Sales trends and projections</li>
                  <li>• Inventory turnover and management</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Customer Reviews</CardTitle>
              <CardDescription>
                What your customers are saying about your products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    product: "Premium Bluetooth Headphones",
                    customer: "Alex Thompson",
                    rating: 5,
                    date: "2023-06-10",
                    comment: "Excellent sound quality and battery life. Very comfortable to wear for long periods.",
                  },
                  {
                    product: "Handcrafted Wooden Watch",
                    customer: "Jessica Miller",
                    rating: 4,
                    date: "2023-06-08",
                    comment: "Beautiful craftsmanship. The watch is lighter than I expected, which is nice.",
                  },
                  {
                    product: "Organic Face Moisturizer",
                    customer: "Madison Clark",
                    rating: 5,
                    date: "2023-06-05",
                    comment: "My skin feels amazing after using this for just a week. Will definitely purchase again!",
                  },
                ].map((review, i) => (
                  <div key={`review-${i}`} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-medium">{review.product}</h3>
                      <span className="text-sm text-gray-500">{review.date}</span>
                    </div>
                    <div className="mb-2 flex items-center">
                      <div className="mr-2 flex text-yellow-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={`review-${i}-star-${star}`} className={star <= review.rating ? "" : "text-gray-300"}>
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-sm font-medium">by {review.customer}</span>
                    </div>
                    <p className="text-gray-600">{review.comment}</p>
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="sm">Reply</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Management</CardTitle>
              <CardDescription>
                Monitor stock levels and manage your product inventory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {inventory?.stats?.outOfStock || 0}
                      </div>
                      <div className="text-sm text-red-800">Out of Stock</div>
                    </CardContent>
                  </Card>
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {inventory?.stats?.lowStock || 0}
                      </div>
                      <div className="text-sm text-yellow-800">Low Stock (&lt; 10)</div>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {inventory?.stats?.wellStocked || 0}
                      </div>
                      <div className="text-sm text-green-800">Well Stocked</div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Inventory Status</h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Current Stock</TableHead>
                          <TableHead>Reorder Level</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(inventory?.inventory || []).map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.sku}</TableCell>
                            <TableCell>{item.currentStock}</TableCell>
                            <TableCell>{item.reorderLevel}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.status === "in-stock"
                                    ? "default"
                                    : item.status === "low-stock"
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {item.status.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm">
                                Update Stock
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!inventory?.inventory || inventory.inventory.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                              No inventory data available
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications &amp; Alerts</CardTitle>
              <CardDescription>
                Stay updated with important information about your store
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Order Notifications</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">New orders</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Order cancellations</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Payment confirmations</span>
                      </label>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Inventory Alerts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Low stock alerts</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Out of stock alerts</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Reorder reminders</span>
                      </label>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Recent Notifications</h3>
                  <div className="space-y-3">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 10).map((notification: any) => (
                        <div
                          key={notification.id}
                          className={`flex items-start space-x-3 p-3 rounded-lg border ${
                            notification.isRead ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            notification.isRead ? 'bg-gray-300' : 'bg-blue-500'
                          }`}></div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className={`font-medium ${notification.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                                {notification.title}
                              </h4>
                              <span className="text-xs text-gray-500">
                                {new Date(notification.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className={`text-sm ${notification.isRead ? 'text-gray-600' : 'text-gray-800'}`}>
                              {notification.message}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No notifications yet
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline">Mark All as Read</Button>
                  <Button className="bg-[#e16b22] hover:bg-[#cf610d]">Notification Settings</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
