import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'user') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  try {
    if (req.method === 'GET') {
      const addresses = await prisma.savedAddress.findMany({ where: { userId }, orderBy: { isDefault: 'desc' } });
      return res.status(200).json(addresses);
    }

    if (req.method === 'POST') {
      const { label, address, city, country, zipCode, isDefault } = req.body;
      if (!address) return res.status(400).json({ error: 'Address is required' });

      if (isDefault) {
        await prisma.savedAddress.updateMany({ where: { userId }, data: { isDefault: false } });
      }

      const newAddress = await prisma.savedAddress.create({
        data: { userId, label, address, city, country, zipCode, isDefault: isDefault ?? false },
      });
      return res.status(201).json(newAddress);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Address ID required' });
      await prisma.savedAddress.deleteMany({ where: { id: id as string, userId } });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[User Addresses API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
