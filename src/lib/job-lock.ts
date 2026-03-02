import { prisma } from "@/lib/prisma";

const INVENTORY_SCAN_LOCK_KEY_1 = 91357;
const INVENTORY_SCAN_LOCK_KEY_2 = 2026;

type LockQueryRow = {
  locked: boolean;
};

export async function tryAcquireInventoryScanLock(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<LockQueryRow[]>(
      "SELECT pg_try_advisory_lock($1, $2) AS locked",
      INVENTORY_SCAN_LOCK_KEY_1,
      INVENTORY_SCAN_LOCK_KEY_2
    );

    return Boolean(rows?.[0]?.locked);
  } catch (error) {
    console.warn("[job-lock] advisory lock unavailable, continuing without lock:", error);
    return true;
  }
}

export async function releaseInventoryScanLock(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(
      "SELECT pg_advisory_unlock($1, $2)",
      INVENTORY_SCAN_LOCK_KEY_1,
      INVENTORY_SCAN_LOCK_KEY_2
    );
  } catch (error) {
    console.warn("[job-lock] failed to release inventory scan lock:", error);
  }
}
