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

  const methods = await prisma.vendorPaymentMethod.findMany({
    where: { approvalStatus: "pending_admin" },
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
    orderBy: { createdAt: "asc" },
  });

  return res.status(200).json({ methods });
}
