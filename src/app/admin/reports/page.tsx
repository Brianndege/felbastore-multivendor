import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function AdminReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    redirect('/auth/login');
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Order Export</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Export orders to CSV for analysis.</p>
            <Button asChild>
              <Link href="/api/admin/orders/export">Export Orders CSV</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>User Report</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">View user registration and activity trends.</p>
            <Button variant="outline" asChild>
              <Link href="/admin/users">View Users</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Vendor Report</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Review vendor performance and approvals.</p>
            <Button variant="outline" asChild>
              <Link href="/admin/vendors">View Vendors</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Revenue Report</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">View overall platform revenue breakdown.</p>
            <Button variant="outline" asChild>
              <Link href="/admin/dashboard">View Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
