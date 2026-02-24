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
      const products = await prisma.product.findMany({
        include: { vendor: { select: { storeName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return res.status(200).json(products);
    }

    if (req.method === 'PATCH') {
      const { id, isApproved, status } = req.body;
      if (!id) return res.status(400).json({ error: 'Product ID required' });
      const product = await prisma.product.update({
        where: { id },
        data: { ...(isApproved !== undefined && { isApproved }), ...(status && { status }) },
      });
      return res.status(200).json(product);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Admin Products API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
