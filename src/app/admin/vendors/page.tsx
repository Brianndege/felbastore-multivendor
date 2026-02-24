'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Vendor {
  id: string;
  name: string;
  email: string;
  storeName: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  _count: { products: number; orderItems: number };
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/vendors')
      .then(r => r.json())
      .then((data: { vendors: Vendor[] }) => setVendors(data.vendors || []))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, []);

  const approveVendor = async (id: string) => {
    const res = await fetch('/api/admin/vendors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isVerified: true }),
    });
    if (res.ok) {
      toast.success('Vendor approved');
      setVendors(prev => prev.map(v => v.id === id ? { ...v, isVerified: true } : v));
    } else {
      toast.error('Failed to approve vendor');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Vendor Management</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">Store</th>
                <th className="text-left p-3">Owner</th>
                <th className="text-left p-3">Products</th>
                <th className="text-left p-3">Orders</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(vendor => (
                <tr key={vendor.id} className="border-t">
                  <td className="p-3 font-medium">{vendor.storeName}</td>
                  <td className="p-3">
                    <div>{vendor.name}</div>
                    <div className="text-muted-foreground text-xs">{vendor.email}</div>
                  </td>
                  <td className="p-3">{vendor._count.products}</td>
                  <td className="p-3">{vendor._count.orderItems}</td>
                  <td className="p-3">
                    <Badge variant={vendor.isVerified ? 'default' : 'secondary'}>
                      {vendor.isVerified ? 'Verified' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {!vendor.isVerified && (
                      <Button size="sm" onClick={() => approveVendor(vendor.id)}>
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vendors.length === 0 && <p className="text-muted-foreground p-4">No vendors found.</p>}
        </div>
      )}
    </div>
  );
}
