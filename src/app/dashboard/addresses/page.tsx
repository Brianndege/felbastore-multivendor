'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Address {
  id: string;
  label: string | null;
  address: string;
  city: string | null;
  country: string | null;
  zipCode: string | null;
  isDefault: boolean;
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '', address: '', city: '', country: '', zipCode: '' });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/user/addresses');
      if (res.ok) {
        const data = await res.json() as Address[];
        setAddresses(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/user/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success('Address saved');
      setShowForm(false);
      setForm({ label: '', address: '', city: '', country: '', zipCode: '' });
      await fetchAddresses();
    } else {
      toast.error('Failed to save address');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/user/addresses?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Address deleted');
      setAddresses(prev => prev.filter(a => a.id !== id));
    } else {
      toast.error('Failed to delete address');
    }
  };

  if (loading) return <div className="animate-pulse">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Saved Addresses</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Address'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader><CardTitle>New Address</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Label (e.g. Home, Work)</Label>
                  <Input value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="Home" />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={form.country} onChange={e => setForm({...form, country: e.target.value})} required />
                </div>
              </div>
              <div>
                <Label>Street Address *</Label>
                <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
                </div>
                <div>
                  <Label>ZIP Code</Label>
                  <Input value={form.zipCode} onChange={e => setForm({...form, zipCode: e.target.value})} />
                </div>
              </div>
              <Button type="submit">Save Address</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {addresses.length === 0 ? (
        <p className="text-muted-foreground">No saved addresses yet.</p>
      ) : (
        <div className="grid gap-4">
          {addresses.map(addr => (
            <Card key={addr.id}>
              <CardContent className="pt-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {addr.label && <span className="font-medium">{addr.label}</span>}
                    {addr.isDefault && <Badge>Default</Badge>}
                  </div>
                  <p className="text-sm">{addr.address}</p>
                  <p className="text-sm text-muted-foreground">{[addr.city, addr.zipCode, addr.country].filter(Boolean).join(', ')}</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(addr.id)}>Delete</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
