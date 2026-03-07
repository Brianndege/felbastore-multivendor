import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";

const prismaUnsafe = prisma as any;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const configuredJobKey = (process.env.ORDER_SLA_JOB_KEY || process.env.INTERNAL_JOB_KEY || "").trim();
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

  const now = new Date();

  const overdue = await prismaUnsafe.orderVendorFulfillment.findMany({
    where: {
      orderStatus: "PENDING",
      confirmationDueAt: { lte: now },
      acknowledgedAt: null,
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          userId: true,
        },
      },
      vendor: {
        select: {
          id: true,
          storeName: true,
        },
      },
    },
    take: 500,
  });

  if (overdue.length === 0) {
    return res.status(200).json({ ok: true, reminders: 0, adminAlerts: 0, source: hasValidJobKey ? "job-key" : "admin-session" });
  }

  await prismaUnsafe.notification.createMany({
    data: overdue.map((entry: any) => ({
      vendorId: entry.vendorId,
      type: "order",
      priority: "high",
      title: "Pending order requires confirmation",
      message: `Order #${entry.order.orderNumber} is overdue for vendor acknowledgement.`,
      data: JSON.stringify({
        orderId: entry.orderId,
        orderNumber: entry.order.orderNumber,
        vendorId: entry.vendorId,
        confirmationDueAt: entry.confirmationDueAt,
      }),
    })),
  });

  const adminUsers = await prismaUnsafe.user.findMany({
    where: { role: "admin", isActive: true },
    select: { id: true },
    take: 20,
  });

  if (adminUsers.length > 0) {
    const adminAlerts = overdue.flatMap((entry: any) =>
      adminUsers.map((admin: any) => ({
        userId: admin.id,
        type: "order_sla",
        priority: "high",
        title: "Vendor confirmation SLA missed",
        message: `Vendor ${entry.vendor.storeName || entry.vendorId} missed confirmation SLA for order #${entry.order.orderNumber}.`,
        data: JSON.stringify({
          orderId: entry.orderId,
          orderNumber: entry.order.orderNumber,
          vendorId: entry.vendorId,
        }),
      }))
    );

    if (adminAlerts.length > 0) {
      await prismaUnsafe.notification.createMany({ data: adminAlerts });
    }
  }

  await prismaUnsafe.orderStatusAudit.createMany({
    data: overdue.map((entry: any) => ({
      orderId: entry.orderId,
      vendorId: entry.vendorId,
      fromStatus: "PENDING",
      toStatus: "PENDING",
      actorRole: "system",
      note: "Vendor confirmation SLA reminder sent",
      metadata: JSON.stringify({ confirmationDueAt: entry.confirmationDueAt }),
    })),
  });

  return res.status(200).json({
    ok: true,
    reminders: overdue.length,
    adminAlerts: overdue.length * adminUsers.length,
    source: hasValidJobKey ? "job-key" : "admin-session",
  });
}
