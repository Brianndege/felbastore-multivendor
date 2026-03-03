import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const take = Math.min(50, Math.max(1, Number(req.query.take || 24)));

  const products = await prisma.affiliateProduct.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    orderBy: [{ featuredScore: "desc" }, { updatedAt: "desc" }],
    take,
  });

  return res.status(200).json({ products });
}