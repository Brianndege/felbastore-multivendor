import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, {});

  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  const vendorId = session.user.id;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid product ID" });
  }

  // Verify product belongs to the vendor
  const product = await prisma.product.findFirst({
    where: { id, vendorId }
  });

  if (!product && req.method !== "GET") {
    return res.status(404).json({ error: "Product not found" });
  }

  if (req.method === "GET") {
    try {
      const productWithDetails = await prisma.product.findUnique({
        where: { id },
        include: {
          vendor: {
            select: { name: true, storeName: true }
          },
          reviews: {
            include: {
              user: {
                select: { name: true }
              }
            },
            orderBy: { createdAt: "desc" }
          },
          _count: {
            select: { reviews: true, orderItems: true }
          }
        }
      });

      if (!productWithDetails) {
        return res.status(404).json({ error: "Product not found" });
      }

      return res.status(200).json(productWithDetails);
    } catch (error) {
      console.error("Error fetching product:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "PUT") {
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
        status,
        featured
      } = req.body;

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description && { description }),
          ...(price && { price: parseFloat(price) }),
          ...(comparePrice !== undefined && { comparePrice: comparePrice ? parseFloat(comparePrice) : null }),
          ...(images && { images: JSON.stringify(images) }),
          ...(category && { category }),
          ...(subcategory !== undefined && { subcategory }),
          ...(tags && { tags: JSON.stringify(tags) }),
          ...(inventory !== undefined && { inventory: parseInt(inventory) }),
          ...(sku !== undefined && { sku }),
          ...(weight !== undefined && { weight: weight ? parseFloat(weight) : null }),
          ...(dimensions !== undefined && { dimensions: dimensions ? JSON.stringify(dimensions) : null }),
          ...(status && { status }),
          ...(featured !== undefined && { featured: Boolean(featured) }),
        },
      });

      return res.status(200).json(updatedProduct);
    } catch (error) {
      console.error("Error updating product:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "DELETE") {
    try {
      await prisma.product.delete({
        where: { id }
      });

      return res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
