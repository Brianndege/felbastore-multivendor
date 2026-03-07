import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { getVendorVisibilityMap } from "@/lib/vendor-visibility";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const vendors = await prisma.vendor.findMany({
      where: {
        isActive: true,
        isVerified: true,
        NOT: [
          { email: { endsWith: "@example.com", mode: "insensitive" } },
          { storeName: { contains: "DB Health", mode: "insensitive" } },
          { name: { contains: "DB Health", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        storeName: true,
        description: true,
        image: true,
        city: true,
        country: true,
        createdAt: true,
        products: {
          where: {
            status: "active",
            isApproved: true,
            workflowStatus: "APPROVED",
            isDummy: false,
          },
          select: {
            category: true,
            avgRating: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    const salesByVendor = await prisma.orderItem.groupBy({
      by: ["vendorId"],
      _sum: {
        quantity: true,
      },
      where: {
        vendorId: { in: vendors.map((vendor) => vendor.id) },
        product: {
          isDummy: false,
        },
        order: {
          paymentStatus: {
            in: ["paid", "approved", "succeeded"],
          },
        },
      },
    });

    const visibilityMap = await getVendorVisibilityMap(vendors.map((vendor) => vendor.id));

    const salesLookup = new Map(salesByVendor.map((entry) => [entry.vendorId, entry._sum.quantity || 0]));

    const payload = vendors
      .filter((vendor) => {
        const visibility = visibilityMap.get(vendor.id);
        return visibility ? visibility.isPublic : true;
      })
      .map((vendor) => {
      const joinedAt = new Date(vendor.createdAt);
      const isNew = Date.now() - joinedAt.getTime() <= 30 * 24 * 60 * 60 * 1000;
      const ratings = vendor.products
        .map((product) => Number(product.avgRating || 0))
        .filter((value) => Number.isFinite(value) && value > 0);

      const rating = ratings.length > 0
        ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1))
        : 0;

      const categorySet = new Set(
        vendor.products
          .map((product) => product.category)
          .filter((value) => typeof value === "string" && value.trim().length > 0)
      );

      return {
        id: vendor.id,
        name: vendor.name,
        storeName: vendor.storeName,
        description: vendor.description || "Trusted marketplace vendor",
        logo: vendor.image || "/placeholder-product.jpg",
        rating,
        totalProducts: vendor.products.length,
        totalSales: salesLookup.get(vendor.id) || 0,
        joinedDate: vendor.createdAt,
        isNew,
        categories: Array.from(categorySet).slice(0, 4),
        location: [vendor.city, vendor.country].filter(Boolean).join(", ") || "Location not specified",
        verified: true,
      };
    });

    return res.status(200).json({ vendors: payload });
  } catch (error) {
    console.error("Error loading public vendors:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
