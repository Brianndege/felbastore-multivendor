import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { redirect } from 'next/navigation';
import { getUserDashboardStats } from '@/lib/dashboard-helpers';
import { StatsCard } from '@/components/dashboard/stats-card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'user') {
    redirect('/auth/login');
  }

  let stats;
  try {
    stats = await getUserDashboardStats(session.user.id);
  } catch {
    stats = { totalOrders: 0, pendingOrders: 0, totalSpent: 0, savedAddresses: 0, recentOrders: [] };
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Welcome back, {session.user.name}!</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Orders" value={stats.totalOrders} description="All time" />
        <StatsCard title="Pending Orders" value={stats.pendingOrders} description="Awaiting processing" />
        <StatsCard title="Total Spent" value={`$${stats.totalSpent.toFixed(2)}`} description="All time" />
        <StatsCard title="Saved Addresses" value={stats.savedAddresses} description="Delivery addresses" />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
        {stats.recentOrders.length === 0 ? (
          <p className="text-muted-foreground">No orders yet. <Link href="/products" className="text-primary underline">Start shopping!</Link></p>
        ) : (
          <div className="space-y-2">
            {stats.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <p className="font-medium">{order.orderNumber}</p>
                  <p className="text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>{order.status}</Badge>
                  <span className="font-medium">${order.totalAmount.toFixed(2)}</span>
                  <Link href={`/orders/${order.id}`} className="text-sm text-primary hover:underline">View</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
