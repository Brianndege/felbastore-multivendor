import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

  const rows = await prisma.vendorAnalytics.findMany({
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          storeName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
  });

  const activities = rows
    .map((row) => {
      if (!row.data) return null;

      try {
        const payload = JSON.parse(row.data);
        if (!payload?.eventType || !String(payload.eventType).startsWith("product_")) {
          return null;
        }

        return {
          id: row.id,
          createdAt: row.createdAt,
          eventType: payload.eventType,
          productId: payload.productId || null,
          reason: payload.reason || null,
          reviewedBy: payload.reviewedBy || null,
          vendor: row.vendor,
          payload,
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .slice(0, limit);

  return res.status(200).json({
    activities,
    count: activities.length,
  });
}
