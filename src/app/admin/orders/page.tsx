'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  user: { name: string | null; email: string };
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/orders')
      .then(r => r.json())
      .then((data: Order[]) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter(o =>
    o.orderNumber.includes(search) || o.user?.email?.includes(search)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Order Management</h1>
      <Input
        placeholder="Search by order number or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm mb-4"
      />
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Payment</th>
                <th className="text-left p-3">Total</th>
                <th className="text-left p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr key={order.id} className="border-t">
                  <td className="p-3 font-medium">{order.orderNumber}</td>
                  <td className="p-3">
                    <div>{order.user?.name || '-'}</div>
                    <div className="text-xs text-muted-foreground">{order.user?.email}</div>
                  </td>
                  <td className="p-3"><Badge variant="secondary">{order.status}</Badge></td>
                  <td className="p-3">
                    <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'destructive'}>
                      {order.paymentStatus}
                    </Badge>
                  </td>
                  <td className="p-3">${Number(order.totalAmount).toFixed(2)}</td>
                  <td className="p-3">{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-muted-foreground p-4">No orders found.</p>}
        </div>
      )}
    </div>
  );
}
