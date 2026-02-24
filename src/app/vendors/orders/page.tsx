'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
    user: { name: string | null; email: string };
  };
}

export default function VendorOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/login'); return; }
    if (status === 'authenticated' && session?.user.role !== 'vendor') { router.push('/'); return; }
    if (status === 'authenticated') {
      fetch('/api/vendors/orders')
        .then(r => r.json())
        .then((data: OrderItem[]) => setOrders(data))
        .catch(() => setOrders([]))
        .finally(() => setLoading(false));
    }
  }, [status, session, router]);

  if (loading) return <div className="container mx-auto px-4 py-8">Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Orders</h1>
      {orders.length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-muted-foreground">No orders yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {orders.map(item => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{item.order.orderNumber}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={item.order.status === 'delivered' ? 'default' : 'secondary'}>{item.order.status}</Badge>
                    <Badge variant={item.order.paymentStatus === 'paid' ? 'default' : 'destructive'}>{item.order.paymentStatus}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{item.productName} × {item.quantity}</p>
                <p className="text-sm text-muted-foreground">Customer: {item.order.user.name || item.order.user.email}</p>
                <p className="text-sm text-muted-foreground">{new Date(item.order.createdAt).toLocaleDateString()}</p>
                <p className="text-sm font-semibold mt-2">${Number(item.price * item.quantity).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
