import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const { page = '1', limit = '20', verified } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where = verified !== undefined ? { isVerified: verified === 'true' } : {};

      const [vendors, total] = await Promise.all([
        prisma.vendor.findMany({
          where,
          select: {
            id: true, name: true, email: true, storeName: true, isVerified: true,
            isActive: true, createdAt: true, commissionRate: true,
            _count: { select: { products: true, orderItems: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.vendor.count({ where }),
      ]);

      return res.status(200).json({ vendors, total, page: pageNum, limit: limitNum });
    }

    if (req.method === 'PATCH') {
      const { id, isVerified, isActive } = req.body;
      if (!id) return res.status(400).json({ error: 'Vendor ID is required' });

      const vendor = await prisma.vendor.update({
        where: { id },
        data: { ...(isVerified !== undefined && { isVerified }), ...(isActive !== undefined && { isActive }) },
        select: { id: true, name: true, storeName: true, isVerified: true, isActive: true },
      });
      return res.status(200).json(vendor);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Admin Vendors API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
