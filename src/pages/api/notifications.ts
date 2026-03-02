import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const unreadOnly = req.query.unreadOnly === "true";
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    const where =
      session.user.role === "vendor"
        ? { vendorId: session.user.id, ...(unreadOnly ? { isRead: false } : {}) }
        : { userId: session.user.id, ...(unreadOnly ? { isRead: false } : {}) };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);

    return res.status(200).json({
      notifications,
      unreadCount,
    });
  }

  if (req.method === "PATCH") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }

    const { ids, markAllRead } = req.body as { ids?: string[]; markAllRead?: boolean };

    const actorWhere = session.user.role === "vendor" ? { vendorId: session.user.id } : { userId: session.user.id };

    if (markAllRead) {
      const result = await prisma.notification.updateMany({
        where: {
          ...actorWhere,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return res.status(200).json({
        message: "All notifications marked as read",
        updatedCount: result.count,
      });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Provide notification ids or markAllRead=true" });
    }

    const result = await prisma.notification.updateMany({
      where: {
        ...actorWhere,
        id: { in: ids },
      },
      data: {
        isRead: true,
      },
    });

    return res.status(200).json({
      message: "Notifications marked as read",
      updatedCount: result.count,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
