import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { getVendorVisibilityMap, setVendorVisibility } from "@/lib/vendor-visibility";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 80));

    const vendors = await prisma.vendor.findMany({
      where: {
        isActive: true,
        ...(q
          ? {
              OR: [
                { storeName: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        storeName: true,
        email: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const visibilityMap = await getVendorVisibilityMap(vendors.map((vendor) => vendor.id));

    return res.status(200).json({
      vendors: vendors.map((vendor) => {
        const visibility = visibilityMap.get(vendor.id);
        return {
          ...vendor,
          isPublic: visibility ? visibility.isPublic : true,
          visibilityReason: visibility?.reason || null,
          visibilityUpdatedAt: visibility?.updatedAt || null,
        };
      }),
    });
  }

  if (req.method === "PATCH") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }

    const vendorId = typeof req.body?.vendorId === "string" ? req.body.vendorId : "";
    const isPublic = typeof req.body?.isPublic === "boolean" ? req.body.isPublic : null;
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";

    if (!vendorId || isPublic === null) {
      return res.status(400).json({ error: "vendorId and isPublic are required" });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    await setVendorVisibility({
      vendorId,
      isPublic,
      reason,
      updatedBy: session.user.id,
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
