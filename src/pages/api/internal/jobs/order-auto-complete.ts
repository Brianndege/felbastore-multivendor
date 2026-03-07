import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";

const prismaUnsafe = prisma as any;

const AUTO_COMPLETE_GRACE_DAYS = Number(process.env.ORDER_AUTO_COMPLETE_GRACE_DAYS || 7);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const configuredJobKey = (process.env.ORDER_AUTO_COMPLETE_JOB_KEY || process.env.INTERNAL_JOB_KEY || "").trim();
  const providedJobKey = String(req.headers["x-job-key"] || req.headers["x-internal-job-key"] || "").trim();
  const hasValidJobKey = Boolean(configuredJobKey) && configuredJobKey === providedJobKey;

  if (!hasValidJobKey) {
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!enforceCsrfOrigin(req, res)) {
      return;
    }
  }

  const cutoff = new Date(Date.now() - AUTO_COMPLETE_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const eligible = await prismaUnsafe.orderVendorFulfillment.findMany({
    where: {
      orderStatus: "DELIVERED",
      deliveredAt: { lte: cutoff },
      completedAt: null,
      refundedAt: null,
      cancelledAt: null,
      disputeOpenedAt: null,
    },
    select: {
      orderId: true,
      vendorId: true,
      order: {
        select: {
          orderNumber: true,
          userId: true,
        },
      },
    },
    take: 500,
  });

  if (eligible.length === 0) {
    return res.status(200).json({ ok: true, completed: 0, source: hasValidJobKey ? "job-key" : "admin-session" });
  }

  const now = new Date();

  await prismaUnsafe.$transaction(
    eligible.map((entry: any) =>
      prismaUnsafe.orderVendorFulfillment.update({
        where: {
          orderId_vendorId: {
            orderId: entry.orderId,
            vendorId: entry.vendorId,
          },
        },
        data: {
          orderStatus: "COMPLETED",
          completedAt: now,
          payoutReleasedAt: now,
        },
      })
    )
  );

  await prismaUnsafe.orderStatusAudit.createMany({
    data: eligible.map((entry: any) => ({
      orderId: entry.orderId,
      vendorId: entry.vendorId,
      fromStatus: "DELIVERED",
      toStatus: "COMPLETED",
      actorRole: "system",
      note: `Order auto-completed after ${AUTO_COMPLETE_GRACE_DAYS} day grace period`,
    })),
  });

  await prismaUnsafe.notification.createMany({
    data: eligible.flatMap((entry: any) => [
      {
        userId: entry.order.userId,
        type: "order",
        title: "Order Completed",
        message: `Order #${entry.order.orderNumber} has been automatically completed.`,
        data: JSON.stringify({ orderId: entry.orderId, vendorId: entry.vendorId }),
      },
      {
        vendorId: entry.vendorId,
        type: "order",
        title: "Order Completed",
        message: `Order #${entry.order.orderNumber} has been automatically completed and payout released.`,
        data: JSON.stringify({ orderId: entry.orderId, vendorId: entry.vendorId }),
      },
    ]),
  });

  return res.status(200).json({
    ok: true,
    completed: eligible.length,
    source: hasValidJobKey ? "job-key" : "admin-session",
  });
}
