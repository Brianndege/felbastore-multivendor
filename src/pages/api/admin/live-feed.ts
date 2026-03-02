import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { readOutboxEventsSince } from "@/lib/outbox";

type LiveEvent = {
  id: string;
  type: string;
  createdAt: string;
  title: string;
  payload: Record<string, unknown>;
};

function writeSse(res: NextApiResponse, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function getSnapshot() {
  const [newUsers, newVendors, newOrders, failedPayments, flaggedContent, verificationQueue] = await Promise.all([
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.vendor.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.order.count({
      where: {
        paymentStatus: "failed",
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.product.count({
      where: {
        status: "rejected",
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.vendor.count({ where: { isVerified: false } }),
  ]);

  return {
    newUsers,
    newVendors,
    newOrders,
    failedPayments,
    flaggedContent,
    verificationQueue,
    asOf: new Date().toISOString(),
  };
}

async function synthesizeFallbackEvents(since: Date): Promise<LiveEvent[]> {
  const [users, vendors, orders, failedOrders] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { id: true, email: true, createdAt: true },
    }),
    prisma.vendor.findMany({
      where: { createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { id: true, email: true, storeName: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { id: true, orderNumber: true, totalAmount: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: {
        updatedAt: { gt: since },
        paymentStatus: "failed",
      },
      orderBy: { updatedAt: "asc" },
      take: 20,
      select: { id: true, orderNumber: true, updatedAt: true },
    }),
  ]);

  const events: LiveEvent[] = [
    ...users.map((user) => ({
      id: `user_${user.id}_${user.createdAt.getTime()}`,
      type: "user.registered",
      createdAt: user.createdAt.toISOString(),
      title: "New user registered",
      payload: { userId: user.id, email: user.email },
    })),
    ...vendors.map((vendor) => ({
      id: `vendor_${vendor.id}_${vendor.createdAt.getTime()}`,
      type: "vendor.registered",
      createdAt: vendor.createdAt.toISOString(),
      title: "New vendor signup",
      payload: { vendorId: vendor.id, email: vendor.email, storeName: vendor.storeName },
    })),
    ...orders.map((order) => ({
      id: `order_${order.id}_${order.createdAt.getTime()}`,
      type: "order.created",
      createdAt: order.createdAt.toISOString(),
      title: "New order created",
      payload: { orderId: order.id, orderNumber: order.orderNumber, totalAmount: Number(order.totalAmount) },
    })),
    ...failedOrders.map((order) => ({
      id: `payment_failed_${order.id}_${order.updatedAt.getTime()}`,
      type: "payment.failed",
      createdAt: order.updatedAt.toISOString(),
      title: "Payment failed",
      payload: { orderId: order.id, orderNumber: order.orderNumber },
    })),
  ];

  return events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  let lastCursor = new Date(Date.now() - 5_000);

  writeSse(res, "snapshot", await getSnapshot());
  writeSse(res, "ready", { connectedAt: new Date().toISOString() });

  const interval = setInterval(async () => {
    try {
      const outboxEvents = await readOutboxEventsSince(lastCursor, 100);

      let events: LiveEvent[] = outboxEvents.map((row) => {
        let parsedPayload: Record<string, unknown> = {};

        try {
          parsedPayload = JSON.parse(row.payload);
        } catch {
          parsedPayload = {};
        }

        return {
          id: row.id,
          type: row.topic,
          createdAt: new Date(row.createdAt).toISOString(),
          title: row.topic.replace(/\./g, " "),
          payload: parsedPayload,
        };
      });

      if (events.length === 0) {
        events = await synthesizeFallbackEvents(lastCursor);
      }

      if (events.length > 0) {
        writeSse(res, "events", {
          items: events,
          snapshot: await getSnapshot(),
        });

        const newest = events[events.length - 1];
        lastCursor = new Date(newest.createdAt);
      } else {
        writeSse(res, "heartbeat", { ts: new Date().toISOString() });
      }
    } catch (error) {
      writeSse(res, "error", {
        message: error instanceof Error ? error.message : "Live stream error",
      });
    }
  }, 4_000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
}
