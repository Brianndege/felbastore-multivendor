import type { NextApiRequest, NextApiResponse } from "next";
import { getUnifiedMarketplaceFeed } from "@/lib/affiliate/feed";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const threshold = Number(req.query.threshold || process.env.AFFILIATE_FALLBACK_THRESHOLD || 12);
    const take = Math.min(50, Math.max(1, Number(req.query.take || 24)));
    const feed = await getUnifiedMarketplaceFeed({ threshold, take });

    return res.status(200).json({
      ...feed,
      disclosure: "Some products may be sold by external affiliate partners.",
    });
  } catch (error) {
    console.error("[products-feed]", error);
    return res.status(500).json({ error: "Unable to load marketplace feed" });
  }
}