import { prisma } from "@/lib/prisma";
import { enqueueOutboxEvent } from "@/lib/outbox";

type SyncOptions = {
  vendorId?: string;
  lookbackHours?: number;
  maxProducts?: number;
};

type SyncResult = {
  scannedProducts: number;
  createdAlerts: number;
  skippedAlerts: number;
  vendorsAffected: number;
};

export async function syncInventoryAlerts(options: SyncOptions = {}): Promise<SyncResult> {
  const lookbackHours = Math.max(1, options.lookbackHours ?? 24);
  const maxProducts = Math.min(1000, Math.max(10, options.maxProducts ?? 250));
  const lookbackDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const products = await prisma.product.findMany({
    where: {
      ...(options.vendorId ? { vendorId: options.vendorId } : {}),
      inventory: {
        lte: 50,
      },
    },
    orderBy: [{ inventory: "asc" }, { updatedAt: "desc" }],
    take: maxProducts,
    select: {
      id: true,
      name: true,
      vendorId: true,
      inventory: true,
      lowStockThreshold: true,
    },
  });

  const candidates = products.filter((product) => product.inventory <= product.lowStockThreshold);

  if (candidates.length === 0) {
    return {
      scannedProducts: 0,
      createdAlerts: 0,
      skippedAlerts: 0,
      vendorsAffected: 0,
    };
  }

  const productIds = candidates.map((product) => product.id);
  const recentAlerts = await prisma.inventoryAlert.findMany({
    where: {
      productId: { in: productIds },
      createdAt: { gte: lookbackDate },
    },
    select: {
      productId: true,
      type: true,
      currentStock: true,
    },
  });

  const recentAlertKeys = new Set(
    recentAlerts.map((alert) => `${alert.productId}:${alert.type || "low_stock"}:${alert.currentStock ?? -1}`)
  );

  let createdAlerts = 0;
  let skippedAlerts = 0;
  const vendorsTouched = new Set<string>();

  for (const product of candidates) {
    const type = product.inventory <= 0 ? "out_of_stock" : "low_stock";
    const dedupeKey = `${product.id}:${type}:${product.inventory}`;

    if (recentAlertKeys.has(dedupeKey)) {
      skippedAlerts += 1;
      continue;
    }

    const message =
      type === "out_of_stock"
        ? `Product "${product.name}" is out of stock.`
        : `Product "${product.name}" is running low (${product.inventory} left).`;

    await prisma.$transaction(async (tx) => {
      await tx.inventoryAlert.create({
        data: {
          vendorId: product.vendorId,
          productId: product.id,
          type,
          threshold: product.lowStockThreshold,
          currentStock: product.inventory,
          message,
        },
      });

      await tx.notification.create({
        data: {
          vendorId: product.vendorId,
          type: "inventory_alert",
          priority: type === "out_of_stock" ? "high" : "normal",
          title: type === "out_of_stock" ? "Out of Stock" : "Low Stock Alert",
          message,
          data: JSON.stringify({
            productId: product.id,
            inventory: product.inventory,
            threshold: product.lowStockThreshold,
            alertType: type,
          }),
        },
      });
    });

    await enqueueOutboxEvent({
      topic: "inventory.alert_created",
      entityType: "product",
      entityId: product.id,
      payload: {
        productId: product.id,
        vendorId: product.vendorId,
        alertType: type,
        inventory: product.inventory,
        threshold: product.lowStockThreshold,
        createdAt: new Date().toISOString(),
      },
    });

    recentAlertKeys.add(dedupeKey);
    createdAlerts += 1;
    vendorsTouched.add(product.vendorId);
  }

  return {
    scannedProducts: candidates.length,
    createdAlerts,
    skippedAlerts,
    vendorsAffected: vendorsTouched.size,
  };
}
