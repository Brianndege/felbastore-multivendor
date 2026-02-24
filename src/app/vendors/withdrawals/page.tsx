'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function WithdrawalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/login'); return; }
    if (status === 'authenticated' && session?.user.role !== 'vendor') { router.push('/'); }
  }, [status, session, router]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Withdrawals</h1>
      <div className="grid gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle>Available Balance</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">$0.00</p>
            <p className="text-sm text-muted-foreground mt-1">Available for withdrawal</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Request Withdrawal</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">Withdrawal functionality coming soon. Contact support to request a withdrawal.</p>
          <Button disabled>Request Withdrawal</Button>
        </CardContent>
      </Card>
    </div>
  );
}
