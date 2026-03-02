import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { syncInventoryAlerts } from "@/lib/inventory-alerts";
import { releaseInventoryScanLock, tryAcquireInventoryScanLock } from "@/lib/job-lock";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const vendorId = typeof req.body?.vendorId === "string" ? req.body.vendorId : undefined;
  const lookbackHours = Number(req.body?.lookbackHours || 24);
  const maxProducts = Number(req.body?.maxProducts || 250);

  const lockAcquired = await tryAcquireInventoryScanLock();
  if (!lockAcquired) {
    return res.status(409).json({
      success: false,
      error: "Inventory scan already running",
      code: "SCAN_ALREADY_RUNNING",
    });
  }

  try {
    const result = await syncInventoryAlerts({
      vendorId,
      lookbackHours,
      maxProducts,
    });

    return res.status(200).json({
      success: true,
      result,
      scannedAt: new Date().toISOString(),
    });
  } finally {
    await releaseInventoryScanLock();
  }
}
