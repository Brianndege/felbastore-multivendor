'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhoneNumber, isValidSafaricomNumber } from '@/lib/mpesa-utils';

interface MpesaFormProps {
  orderId: string;
  amount: number;
  onSuccess: (checkoutRequestId: string) => void;
  onError: (message: string) => void;
}

export function MpesaForm({ orderId, amount, onSuccess, onError }: MpesaFormProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const formatted = formatPhoneNumber(phoneNumber);
    if (!isValidSafaricomNumber(formatted)) {
      setError('Enter a valid Safaricom number (07XX or 254XX)');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/payment/mpesa/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, phoneNumber: formatted, amount }),
      });

      const data = await response.json() as { success: boolean; checkoutRequestId?: string; message: string };

      if (data.success && data.checkoutRequestId) {
        onSuccess(data.checkoutRequestId);
      } else {
        setError(data.message || 'Failed to initiate payment');
        onError(data.message || 'Failed to initiate payment');
      }
    } catch {
      const msg = 'Network error. Please try again.';
      setError(msg);
      onError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
        <Input
          id="mpesa-phone"
          type="tel"
          placeholder="07XX XXX XXX"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          disabled={loading}
          required
        />
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        <p className="text-xs text-muted-foreground mt-1">
          Enter your Safaricom number to receive the STK push
        </p>
      </div>
      <div className="rounded-md bg-muted p-3 text-sm">
        <p className="font-medium">Amount to pay: <span className="text-primary">KES {amount.toLocaleString()}</span></p>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Sending STK Push...' : 'Pay with M-Pesa'}
      </Button>
    </form>
  );
}
