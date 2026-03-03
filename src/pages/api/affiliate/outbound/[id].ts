import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { buildTrackedAffiliateUrl, logAffiliateClick } from "@/lib/affiliate/tracking";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = String(req.query.id || "").trim();
  if (!id) {
    return res.status(400).json({ error: "Affiliate product id is required" });
  }

  const product = await prisma.affiliateProduct.findUnique({
    where: { id },
    select: {
      id: true,
      externalUrl: true,
      affiliateNetwork: true,
      isActive: true,
    },
  });

  if (!product || !product.isActive) {
    return res.status(404).json({ error: "Affiliate product not found" });
  }

  try {
    const clickToken = await logAffiliateClick({
      affiliateProductId: product.id,
      forwardedFor: req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
      referrer: req.headers.referer,
    });

    const redirectUrl = buildTrackedAffiliateUrl({
      baseUrl: product.externalUrl,
      clickToken,
      productId: product.id,
      network: product.affiliateNetwork,
    });

    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error("[affiliate-outbound]", error);
    return res.status(500).json({ error: "Unable to redirect to partner store" });
  }
}