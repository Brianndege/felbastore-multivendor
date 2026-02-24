import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import Link from 'next/link';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'user') {
    redirect('/auth/login');
  }

  const navItems = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/orders', label: 'Orders' },
    { href: '/dashboard/addresses', label: 'Addresses' },
    { href: '/dashboard/reviews', label: 'Reviews' },
    { href: '/dashboard/settings', label: 'Settings' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <aside className="w-56 shrink-0">
          <h2 className="font-semibold text-lg mb-4">My Account</h2>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
