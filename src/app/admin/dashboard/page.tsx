import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { redirect } from 'next/navigation';
import { getAdminDashboardStats } from '@/lib/dashboard-helpers';
import { StatsCard } from '@/components/dashboard/stats-card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    redirect('/auth/login');
  }

  let stats;
  try {
    stats = await getAdminDashboardStats();
  } catch {
    stats = { totalUsers: 0, totalVendors: 0, totalProducts: 0, totalOrders: 0, totalRevenue: 0, pendingVendors: 0, pendingProducts: 0, recentOrders: [], revenueByMonth: [] };
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Users" value={stats.totalUsers} />
        <StatsCard title="Total Vendors" value={stats.totalVendors} description={`${stats.pendingVendors} pending approval`} />
        <StatsCard title="Total Products" value={stats.totalProducts} description={`${stats.pendingProducts} pending approval`} />
        <StatsCard title="Total Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} description={`${stats.totalOrders} orders`} />
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
        <div className="space-y-2">
          {stats.recentOrders.map(order => (
            <div key={order.id} className="flex items-center justify-between border rounded-lg p-4">
              <div>
                <p className="font-medium">{order.orderNumber}</p>
                <p className="text-sm text-muted-foreground">{order.userEmail}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>{order.status}</Badge>
                <span className="font-medium">${order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
