import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, {});

  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const vendorId = session.user.id;

  if (req.method === "GET") {
    try {
      const products = await prisma.product.findMany({
        where: { vendorId },
        include: {
          _count: {
            select: { reviews: true, orderItems: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      return res.status(200).json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    try {
      const {
        name,
        description,
        price,
        comparePrice,
        images,
        category,
        subcategory,
        tags,
        inventory,
        sku,
        weight,
        dimensions,
        featured
      } = req.body;

      if (!name || !description || !price || !category) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const product = await prisma.product.create({
        data: {
          name,
          description,
          price: parseFloat(price),
          comparePrice: comparePrice ? parseFloat(comparePrice) : null,
          images: JSON.stringify(images || []),
          category,
          subcategory,
          tags: JSON.stringify(tags || []),
          inventory: parseInt(inventory) || 0,
          sku,
          weight: weight ? parseFloat(weight) : null,
          dimensions: dimensions ? JSON.stringify(dimensions) : null,
          featured: Boolean(featured),
          vendorId,
        },
      });

      return res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
