import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { syncInventoryAlerts } from "@/lib/inventory-alerts";
import { releaseInventoryScanLock, tryAcquireInventoryScanLock } from "@/lib/job-lock";

function parseNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const configuredJobKey = (process.env.INVENTORY_SCAN_JOB_KEY || process.env.INTERNAL_JOB_KEY || "").trim();
  const providedJobKey = String(req.headers["x-job-key"] || req.headers["x-internal-job-key"] || "").trim();
  const hasValidJobKey = Boolean(configuredJobKey) && providedJobKey === configuredJobKey;

  if (!hasValidJobKey) {
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!enforceCsrfOrigin(req, res)) {
      return;
    }
  }

  const vendorId = typeof req.body?.vendorId === "string" ? req.body.vendorId : undefined;
  const lookbackHours = parseNumber(req.body?.lookbackHours, 24);
  const maxProducts = parseNumber(req.body?.maxProducts, 250);

  const lockAcquired = await tryAcquireInventoryScanLock();
  if (!lockAcquired) {
    return res.status(409).json({
      ok: false,
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
      ok: true,
      source: hasValidJobKey ? "job-key" : "admin-session",
      result,
      scannedAt: new Date().toISOString(),
    });
  } finally {
    await releaseInventoryScanLock();
  }
}
