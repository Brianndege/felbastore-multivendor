import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

type ProductStatusFilter = "pending" | "approved" | "rejected" | "active" | "inactive";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    vendorId,
    category,
    status,
    q,
    startDate,
    endDate,
    page = "1",
    pageSize = "20",
  } = req.query;

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSizeNumber = Math.min(100, Math.max(1, Number(pageSize) || 20));

  const where: any = {};

  if (typeof vendorId === "string" && vendorId) {
    where.vendorId = vendorId;
  }

  if (typeof category === "string" && category.trim()) {
    where.category = category.trim();
  }

  if (typeof status === "string" && status.trim()) {
    const normalizedStatus = status.trim().toLowerCase() as ProductStatusFilter;
    if (normalizedStatus === "pending") {
      where.isApproved = false;
      where.workflowStatus = "PENDING_APPROVAL";
    } else if (normalizedStatus === "approved") {
      where.isApproved = true;
    } else if (normalizedStatus === "rejected") {
      where.isApproved = false;
      where.workflowStatus = "REJECTED";
    } else {
      where.status = normalizedStatus;
    }
  }

  if (typeof q === "string" && q.trim()) {
    const query = q.trim();
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { sku: { contains: query, mode: "insensitive" } },
      { category: { contains: query, mode: "insensitive" } },
      { tags: { has: query } },
      { vendor: { name: { contains: query, mode: "insensitive" } } },
      { vendor: { storeName: { contains: query, mode: "insensitive" } } },
    ];
  }

  if ((typeof startDate === "string" && startDate) || (typeof endDate === "string" && endDate)) {
    where.createdAt = {
      ...(where.createdAt || {}),
      ...(typeof startDate === "string" && startDate ? { gte: new Date(startDate) } : {}),
      ...(typeof endDate === "string" && endDate ? { lte: new Date(endDate) } : {}),
    };
  }

  const [products, totalCount, pendingCount] = await Promise.all([
    prisma.product.findMany({
      where,
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
      skip: (pageNumber - 1) * pageSizeNumber,
      take: pageSizeNumber,
    }),
    prisma.product.count({ where }),
    prisma.product.count({ where: { workflowStatus: "PENDING_APPROVAL", isApproved: false } }),
  ]);

  return res.status(200).json({
    products,
    totalCount,
    pendingCount,
    page: pageNumber,
    pageSize: pageSizeNumber,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSizeNumber)),
  });
}
