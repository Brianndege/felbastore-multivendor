import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'user') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const reviews = await prisma.review.findMany({
      where: { userId: session.user.id },
      include: {
        product: { select: { id: true, name: true, images: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(reviews);
  } catch (error) {
    console.error('[User Reviews API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
