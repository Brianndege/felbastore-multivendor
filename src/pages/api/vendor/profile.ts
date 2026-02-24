import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'vendor') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const vendorId = session.user.id;

  try {
    if (req.method === 'GET') {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true, name: true, email: true, storeName: true, description: true, phone: true, address: true, website: true },
      });
      return res.status(200).json(vendor);
    }

    if (req.method === 'PATCH') {
      const { storeName, description, phone, address, website } = req.body;
      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: {
          ...(storeName && { storeName }),
          ...(description !== undefined && { description }),
          ...(phone && { phone }),
          ...(address && { address }),
          ...(website && { website }),
        },
        select: { id: true, storeName: true, description: true },
      });
      return res.status(200).json(vendor);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Vendor Profile API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
