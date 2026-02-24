import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

type Role = 'user' | 'vendor' | 'admin';
type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void;

export function withRole(role: Role | Role[], handler: Handler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const allowedRoles = Array.isArray(role) ? role : [role];
    if (!allowedRoles.includes(session.user.role as Role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return handler(req, res);
  };
}

export function withAuth(handler: Handler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return handler(req, res);
  };
}
