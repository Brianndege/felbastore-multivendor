import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { syncInventoryAlerts } from "@/lib/inventory-alerts";

type InventoryRow = {
  id: string;
  name: string;
  sku: string | null;
  inventory: number;
  lowStockThreshold: number;
  stockStatus: "out_of_stock" | "low_stock" | "well_stocked";
  estimatedStockValue: number;
  soldCount: number;
  updatedAt: Date;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const vendorId = session.user.id;

  try {
    await syncInventoryAlerts({
      vendorId,
      lookbackHours: 24,
      maxProducts: 250,
    });
  } catch (error) {
    console.warn("[vendor/inventory] failed to sync inventory alerts:", error);
  }

  const products = await prisma.product.findMany({
    where: { vendorId },
    select: {
      id: true,
      name: true,
      sku: true,
      inventory: true,
      lowStockThreshold: true,
      soldCount: true,
      price: true,
      updatedAt: true,
    },
    orderBy: [{ inventory: "asc" }, { updatedAt: "desc" }],
  });

  const inventoryRows: InventoryRow[] = products.map((product) => {
    let stockStatus: InventoryRow["stockStatus"] = "well_stocked";

    if (product.inventory <= 0) {
      stockStatus = "out_of_stock";
    } else if (product.inventory <= product.lowStockThreshold) {
      stockStatus = "low_stock";
    }

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      inventory: product.inventory,
      lowStockThreshold: product.lowStockThreshold,
      stockStatus,
      estimatedStockValue: Number(product.price) * product.inventory,
      soldCount: product.soldCount,
      updatedAt: product.updatedAt,
    };
  });

  const outOfStock = inventoryRows.filter((row) => row.stockStatus === "out_of_stock").length;
  const lowStock = inventoryRows.filter((row) => row.stockStatus === "low_stock").length;
  const wellStocked = inventoryRows.filter((row) => row.stockStatus === "well_stocked").length;
  const totalEstimatedStockValue = inventoryRows.reduce((sum, row) => sum + row.estimatedStockValue, 0);

  return res.status(200).json({
    stats: {
      outOfStock,
      lowStock,
      wellStocked,
      totalProducts: inventoryRows.length,
      totalEstimatedStockValue: Number(totalEstimatedStockValue.toFixed(2)),
    },
    inventory: inventoryRows.slice(0, 50).map((row) => ({
      ...row,
      estimatedStockValue: Number(row.estimatedStockValue.toFixed(2)),
      updatedAt: row.updatedAt.toISOString(),
    })),
    alerts: inventoryRows
      .filter((row) => row.stockStatus === "out_of_stock" || row.stockStatus === "low_stock")
      .slice(0, 20)
      .map((row) => ({
        productId: row.id,
        name: row.name,
        sku: row.sku,
        stockStatus: row.stockStatus,
        inventory: row.inventory,
        lowStockThreshold: row.lowStockThreshold,
      })),
    generatedAt: new Date().toISOString(),
  });
}
