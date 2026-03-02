import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

type RevenueBucket = { month: string; amount: number };

const PAID_STATUSES = ["paid", "approved", "succeeded"];

function monthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "short" });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const vendorId = session.user.id;
  const now = new Date();

  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfSixMonths = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    productCount,
    avgRatings,
    lowStockCount,
    pendingOrderItems,
    paidOrderItems,
    monthlyPaidOrderItems,
    recentOrderItems,
    topProducts,
  ] = await Promise.all([
    prisma.product.count({ where: { vendorId } }),
    prisma.product.aggregate({
      where: { vendorId },
      _avg: { avgRating: true },
    }),
    prisma.product.count({
      where: {
        vendorId,
        inventory: { lte: 10 },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        vendorId,
        order: {
          status: { in: ["pending", "processing"] },
        },
      },
      select: { orderId: true },
      distinct: ["orderId"],
    }),
    prisma.orderItem.findMany({
      where: {
        vendorId,
        order: {
          paymentStatus: { in: PAID_STATUSES },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        vendorId,
        order: {
          paymentStatus: { in: PAID_STATUSES },
          createdAt: { gte: startOfSixMonths },
        },
      },
      include: {
        order: {
          select: {
            createdAt: true,
          },
        },
      },
    }),
    prisma.orderItem.findMany({
      where: { vendorId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        order: {
          createdAt: "desc",
        },
      },
      take: 10,
    }),
    prisma.product.findMany({
      where: { vendorId },
      select: {
        id: true,
        name: true,
        soldCount: true,
        inventory: true,
        price: true,
      },
      orderBy: [{ soldCount: "desc" }, { updatedAt: "desc" }],
      take: 5,
    }),
  ]);

  const paidOrderIds = new Set<string>();
  let totalSales = 0;
  for (const item of paidOrderItems) {
    totalSales += Number(item.price) * item.quantity;
    paidOrderIds.add(item.order.id);
  }

  let currentMonthRevenue = 0;
  let previousMonthRevenue = 0;

  const monthMap = new Map<string, number>();
  for (let index = 0; index < 6; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    monthMap.set(`${date.getFullYear()}-${date.getMonth()}`, 0);
  }

  for (const item of monthlyPaidOrderItems) {
    const createdAt = new Date(item.order.createdAt);
    const amount = Number(item.price) * item.quantity;
    const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;

    monthMap.set(key, (monthMap.get(key) || 0) + amount);

    if (createdAt >= startOfCurrentMonth) {
      currentMonthRevenue += amount;
    } else if (createdAt >= startOfPreviousMonth && createdAt < startOfCurrentMonth) {
      previousMonthRevenue += amount;
    }
  }

  const monthlyGrowth = previousMonthRevenue > 0
    ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
    : currentMonthRevenue > 0
      ? 100
      : 0;

  const revenue: RevenueBucket[] = Array.from(monthMap.entries()).map(([key, value]) => {
    const [year, month] = key.split("-").map(Number);
    return {
      month: monthLabel(new Date(year, month, 1)),
      amount: Number(value.toFixed(2)),
    };
  });

  const recentOrders = recentOrderItems.map((item) => ({
    orderId: item.order.id,
    orderNumber: item.order.orderNumber,
    productName: item.productName,
    quantity: item.quantity,
    lineAmount: Number(item.price) * item.quantity,
    status: item.order.status,
    paymentStatus: item.order.paymentStatus,
    createdAt: item.order.createdAt,
  }));

  return res.status(200).json({
    summary: {
      totalSales: Number(totalSales.toFixed(2)),
      orderCount: paidOrderIds.size,
      productCount,
      averageRating: Number(avgRatings._avg.avgRating || 0),
      monthlyGrowth: Number(monthlyGrowth.toFixed(2)),
      pendingOrders: pendingOrderItems.length,
      lowStockCount,
    },
    revenue,
    recentOrders,
    topProducts: topProducts.map((product) => ({
      id: product.id,
      name: product.name,
      soldCount: product.soldCount,
      inventory: product.inventory,
      price: Number(product.price),
    })),
  });
}
