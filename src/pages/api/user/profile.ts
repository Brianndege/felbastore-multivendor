import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const userId = session.user.id;

  try {
    if (req.method === 'GET') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phone: true, city: true, country: true, image: true },
      });
      return res.status(200).json(user);
    }

    if (req.method === 'PATCH') {
      const { name, phone, city, country } = req.body;
      const user = await prisma.user.update({
        where: { id: userId },
        data: { ...(name && { name }), ...(phone && { phone }), ...(city && { city }), ...(country && { country }) },
        select: { id: true, name: true, email: true, phone: true, city: true, country: true },
      });
      return res.status(200).json(user);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[User Profile API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
