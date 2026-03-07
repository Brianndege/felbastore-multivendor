import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";

const prismaUnsafe = prisma as any;

type SessionUser = {
  id: string;
  role: string;
};

function parseSessionUser(session: unknown): SessionUser | null {
  const user = (session as { user?: SessionUser } | null)?.user;
  if (!user?.id || !user?.role) return null;
  return user;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const orderId = typeof req.query.id === "string" ? req.query.id : "";
  if (!orderId) {
    return res.status(400).json({ error: "Invalid order id" });
  }

  const session = await getServerSession(req, res, authOptions);
  const user = parseSessionUser(session);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    return getMessages(req, res, orderId, user);
  }

  if (req.method === "POST") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }
    return postMessage(req, res, orderId, user);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getMessages(req: NextApiRequest, res: NextApiResponse, orderId: string, user: SessionUser) {
  const requestedVendorId = typeof req.query.vendorId === "string" ? req.query.vendorId.trim() : "";

  const order = await prismaUnsafe.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      vendorFulfillments: {
        select: {
          vendorId: true,
          vendor: {
            select: {
              id: true,
              name: true,
              storeName: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  let scopedVendorId = requestedVendorId;

  if (user.role === "user") {
    if (order.userId !== user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (scopedVendorId && !order.vendorFulfillments.some((entry: any) => entry.vendorId === scopedVendorId)) {
      return res.status(400).json({ error: "Invalid vendor scope" });
    }
  } else if (user.role === "vendor") {
    const vendorMatch = order.vendorFulfillments.find((entry: any) => entry.vendorId === user.id);
    if (!vendorMatch) {
      return res.status(403).json({ error: "Not authorized" });
    }
    scopedVendorId = user.id;
  } else if (user.role !== "admin") {
    return res.status(403).json({ error: "Unsupported role" });
  }

  const messages = await prismaUnsafe.orderConversationMessage.findMany({
    where: {
      orderId,
      ...(scopedVendorId ? { vendorId: scopedVendorId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      vendorId: true,
      customerId: true,
      senderRole: true,
      senderId: true,
      message: true,
      createdAt: true,
      vendor: {
        select: {
          id: true,
          name: true,
          storeName: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return res.status(200).json({
    messages: messages.map((entry: any) => ({
      id: entry.id,
      vendorId: entry.vendorId,
      customerId: entry.customerId,
      senderRole: entry.senderRole,
      senderId: entry.senderId,
      message: entry.message,
      createdAt: entry.createdAt,
      vendorName: entry.vendor.storeName || entry.vendor.name,
      customerName: entry.customer.name || entry.customer.email,
    })),
  });
}

async function postMessage(req: NextApiRequest, res: NextApiResponse, orderId: string, user: SessionUser) {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const requestedVendorId = typeof req.body?.vendorId === "string" ? req.body.vendorId.trim() : "";

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  if (message.length > 1500) {
    return res.status(400).json({ error: "message is too long" });
  }

  const order = await prismaUnsafe.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      vendorFulfillments: {
        select: {
          vendorId: true,
        },
      },
    },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  let targetVendorId = requestedVendorId;

  if (user.role === "user") {
    if (order.userId !== user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (!targetVendorId) {
      return res.status(400).json({ error: "vendorId is required for customer messages" });
    }

    if (!order.vendorFulfillments.some((entry: any) => entry.vendorId === targetVendorId)) {
      return res.status(400).json({ error: "Invalid vendorId for this order" });
    }
  } else if (user.role === "vendor") {
    const vendorMatch = order.vendorFulfillments.some((entry: any) => entry.vendorId === user.id);
    if (!vendorMatch) {
      return res.status(403).json({ error: "Not authorized" });
    }
    targetVendorId = user.id;
  } else {
    return res.status(403).json({ error: "Only customers and vendors can post messages" });
  }

  const created = await prismaUnsafe.orderConversationMessage.create({
    data: {
      orderId,
      vendorId: targetVendorId,
      customerId: order.userId,
      senderRole: user.role,
      senderId: user.id,
      message,
    },
    select: {
      id: true,
      vendorId: true,
      customerId: true,
      senderRole: true,
      senderId: true,
      message: true,
      createdAt: true,
    },
  });

  const notifyCustomer = user.role === "vendor";
  await prismaUnsafe.notification.create({
    data: {
      ...(notifyCustomer ? { userId: order.userId } : { vendorId: targetVendorId }),
      type: "order_message",
      title: notifyCustomer ? "New Vendor Message" : "New Customer Message",
      message: `New message on order #${order.orderNumber}.`,
      data: JSON.stringify({ orderId, vendorId: targetVendorId }),
    },
  });

  return res.status(201).json({
    message: {
      id: created.id,
      vendorId: created.vendorId,
      customerId: created.customerId,
      senderRole: created.senderRole,
      senderId: created.senderId,
      message: created.message,
      createdAt: created.createdAt,
    },
  });
}
