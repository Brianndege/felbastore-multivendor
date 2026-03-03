import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = String(req.query.id || "").trim();
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  const product = await prisma.affiliateProduct.findUnique({
    where: { id },
  });

  if (!product || !product.isActive) {
    return res.status(404).json({ error: "Affiliate product not found" });
  }

  return res.status(200).json({ product });
}