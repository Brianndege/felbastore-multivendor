"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// Status badge styling
const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    case "confirmed":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "processing":
      return "bg-purple-100 text-purple-800 hover:bg-purple-100";
    case "shipped":
      return "bg-indigo-100 text-indigo-800 hover:bg-indigo-100";
    case "delivered":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "cancelled":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    case "paid":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "failed":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  }
};

// Order type definition
interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  productName: string;
  productImage: string;
  product: {
    id: string;
    name: string;
    images: string;
    vendor: {
      id: string;
      name: string;
      storeName: string;
    };
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  orderItems: OrderItem[];
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/login?callbackUrl=/orders");
      return;
    }

    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/orders");
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        } else {
          toast.error("Failed to fetch orders");
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        toast.error("An error occurred while fetching your orders");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [session, status, router]);

  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#e16b22] border-t-transparent rounded-full inline-block mb-4"></div>
          <p>Loading your orders...</p>
        </div>
      </div>
    );
  }

  // Filter orders based on active tab
  const filteredOrders = activeTab === "all"
    ? orders
    : orders.filter(order => {
        if (activeTab === "pending") return ["pending", "confirmed", "processing"].includes(order.status);
        if (activeTab === "shipped") return ["shipped"].includes(order.status);
        if (activeTab === "delivered") return ["delivered"].includes(order.status);
        if (activeTab === "cancelled") return ["cancelled"].includes(order.status);
        return true;
      });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Orders</h1>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid grid-cols-5 mb-8 w-full max-w-3xl">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="shipped">Shipped</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">No orders found</h3>
              <p className="text-gray-500 mb-6">
                {activeTab === "all"
                  ? "You haven't placed any orders yet."
                  : `You don't have any ${activeTab} orders.`}
              </p>
              <Button asChild className="bg-[#e16b22] hover:bg-[#cf610d]">
                <Link href="/products">Start Shopping</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="bg-gray-50 pb-4">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                      <div>
                        <CardTitle className="text-lg">
                          Order #{order.orderNumber}
                        </CardTitle>
                        <CardDescription>
                          Placed on {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={getStatusColor(order.status)}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                        <Badge variant="outline" className={getStatusColor(order.paymentStatus)}>
                          Payment: {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Order items summary - show first 2 items plus count if more */}
                      {order.orderItems.slice(0, 2).map((item) => {
                        const images = typeof item.product?.images === 'string'
                          ? JSON.parse(item.product.images || '[]')
                          : item.product?.images || [];

                        return (
                          <div key={item.id} className="flex items-start gap-4">
                            <div className="h-16 w-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                              <img
                                src={item.productImage || images[0] || '/placeholder-product.jpg'}
                                alt={item.productName || item.product?.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-base truncate">
                                {item.productName || item.product?.name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                Qty: {item.quantity} × ${(typeof item.price === 'number'
                                  ? item.price
                                  : parseFloat(item.price.toString())).toFixed(2)}
                              </p>
                              {item.product?.vendor && (
                                <p className="text-xs text-gray-500">
                                  Sold by: {item.product.vendor.storeName || item.product.vendor.name}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-medium">
                                ${((typeof item.price === 'number'
                                  ? item.price
                                  : parseFloat(item.price.toString())) * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* If there are more items, show a count */}
                      {order.orderItems.length > 2 && (
                        <p className="text-sm text-gray-500 italic">
                          +{order.orderItems.length - 2} more {order.orderItems.length - 2 === 1 ? "item" : "items"}
                        </p>
                      )}

                      <Separator />

                      {/* Order total */}
                      <div className="flex justify-between">
                        <span className="font-semibold">Total</span>
                        <span className="font-bold">
                          ${(typeof order.totalAmount === 'number'
                            ? order.totalAmount
                            : parseFloat(order.totalAmount.toString())).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between bg-gray-50">
                    <Button variant="outline" asChild size="sm">
                      <Link href={`/orders/${order.id}`}>
                        Order Details
                      </Link>
                    </Button>
                    {(order.status === "delivered") && (
                      <Button size="sm" className="bg-[#e16b22] hover:bg-[#cf610d]">
                        Write a Review
                      </Button>
                    )}
                    {(order.status === "pending" && order.paymentStatus !== "paid") && (
                      <Button size="sm" className="bg-[#e16b22] hover:bg-[#cf610d]" asChild>
                        <Link href={`/checkout/payment/${order.id}`}>
                          Complete Payment
                        </Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
