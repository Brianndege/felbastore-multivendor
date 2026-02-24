import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getAdminDashboardStats } from '@/lib/dashboard-helpers';
import type { AdminStats } from '@/types/dashboard';

export default async function handler(req: NextApiRequest, res: NextApiResponse<AdminStats | { error: string }>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const stats = await getAdminDashboardStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error('[Admin Stats] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
