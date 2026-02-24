import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'vendor') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const vendorId = session.user.id;

  try {
    const orderItems = await prisma.orderItem.findMany({
      where: { vendorId },
      include: {
        order: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        product: { select: { name: true, images: true } },
      },
      orderBy: { order: { createdAt: 'desc' } },
    });

    return res.status(200).json(orderItems);
  } catch (error) {
    console.error('[Vendors Orders API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
