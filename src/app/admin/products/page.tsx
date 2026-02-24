'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  status: string;
  isApproved: boolean;
  vendor: { storeName: string };
  createdAt: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/products')
      .then(r => r.json())
      .then((data: Product[]) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const approveProduct = async (id: string) => {
    const res = await fetch('/api/admin/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isApproved: true }),
    });
    if (res.ok) {
      toast.success('Product approved');
      setProducts(prev => prev.map(p => p.id === id ? { ...p, isApproved: true } : p));
    } else {
      toast.error('Failed to approve product');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Product Moderation</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3">Vendor</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Price</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-t">
                  <td className="p-3 font-medium">{product.name}</td>
                  <td className="p-3">{product.vendor?.storeName}</td>
                  <td className="p-3">{product.category}</td>
                  <td className="p-3">${Number(product.price).toFixed(2)}</td>
                  <td className="p-3">
                    <Badge variant={product.isApproved ? 'default' : 'secondary'}>
                      {product.isApproved ? 'Approved' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {!product.isApproved && (
                      <Button size="sm" onClick={() => approveProduct(product.id)}>
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <p className="text-muted-foreground p-4">No products found.</p>}
        </div>
      )}
    </div>
  );
}
