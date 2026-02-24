'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { StatsCard } from '@/components/dashboard/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VendorStats } from '@/types/dashboard';

export default function VendorAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/login'); return; }
    if (status === 'authenticated' && session?.user.role !== 'vendor') { router.push('/'); return; }
    if (status === 'authenticated') {
      fetch('/api/vendors/dashboard/stats')
        .then(r => r.json())
        .then((data: VendorStats) => setStats(data))
        .catch(() => setStats(null))
        .finally(() => setLoading(false));
    }
  }, [status, session, router]);

  if (loading) return <div className="container mx-auto px-4 py-8">Loading...</div>;
  if (!stats) return <div className="container mx-auto px-4 py-8">Failed to load analytics.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} description="All time" />
        <StatsCard title="Total Orders" value={stats.totalOrders} description="All time" />
        <StatsCard title="Total Products" value={stats.totalProducts} description="Listed products" />
        <StatsCard title="Avg Rating" value={`${stats.avgRating}/5`} description="Customer rating" />
      </div>
      <Card>
        <CardHeader><CardTitle>Monthly Revenue</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.monthlyRevenue.map(m => (
              <div key={m.month} className="flex items-center justify-between">
                <span className="text-sm">{m.month}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">{m.orders} orders</span>
                  <span className="text-sm font-medium">${m.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
