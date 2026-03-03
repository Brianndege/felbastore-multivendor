import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const [products, clicks, conversions] = await Promise.all([
    prisma.affiliateProduct.findMany({
      where: { isActive: true },
      select: { id: true, affiliateNetwork: true, category: true },
    }),
    prisma.affiliateClick.findMany({
      select: { id: true, affiliateProductId: true, createdAt: true },
    }),
    prisma.affiliateConversion.findMany({
      where: { status: { in: ["approved", "paid", "completed"] } },
      select: { id: true, affiliateProductId: true, amount: true, network: true },
    }),
  ]);

  const productById = new Map(products.map((product) => [product.id, product]));

  const networkClicks = new Map<string, number>();
  for (const click of clicks) {
    const network = productById.get(click.affiliateProductId)?.affiliateNetwork || "UNKNOWN";
    networkClicks.set(network, (networkClicks.get(network) || 0) + 1);
  }

  const networkRevenue = new Map<string, number>();
  const categoryRevenue = new Map<string, number>();
  for (const conversion of conversions) {
    const network = conversion.network || "UNKNOWN";
    const revenue = Number(conversion.amount || 0);
    networkRevenue.set(network, (networkRevenue.get(network) || 0) + revenue);

    const category = productById.get(conversion.affiliateProductId)?.category || "uncategorized";
    categoryRevenue.set(category, (categoryRevenue.get(category) || 0) + revenue);
  }

  const topAffiliateStore = [...networkClicks.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const totalClicks = clicks.length;
  const totalConversions = conversions.length;
  const clickThroughRate = totalClicks === 0 ? 0 : Number(((totalConversions / totalClicks) * 100).toFixed(2));

  return res.status(200).json({
    totals: {
      products: products.length,
      clicks: totalClicks,
      conversions: totalConversions,
      clickThroughRate,
    },
    topAffiliateStore,
    revenueByCategory: Object.fromEntries(categoryRevenue.entries()),
    revenueByNetwork: Object.fromEntries(networkRevenue.entries()),
    clicksByNetwork: Object.fromEntries(networkClicks.entries()),
  });
}