import type { NextApiRequest, NextApiResponse } from "next";
import { runAndLogAffiliateSync } from "@/lib/affiliate/integrations";

const DEFAULT_NETWORKS = [
  "AMAZON_ASSOCIATES",
  "CJ_AFFILIATE",
  "SHAREASALE",
  "RAKUTEN_ADVERTISING",
  "IMPACT",
  "AWIN",
  "SHOPIFY",
  "EBAY_PARTNER_NETWORK",
  "WALMART_AFFILIATE",
  "ALIEXPRESS_PORTALS",
  "ETSY_AFFILIATE",
  "ENVATO",
  "CLICKBANK",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expectedJobKey = process.env.AFFILIATE_SYNC_JOB_KEY;
  const providedJobKey = req.headers["x-job-key"];
  if (!expectedJobKey || providedJobKey !== expectedJobKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const mode = typeof req.body?.mode === "string" ? req.body.mode : "feed";
  const networks = Array.isArray(req.body?.networks) && req.body.networks.length > 0 ? req.body.networks : DEFAULT_NETWORKS;

  const results: Array<{ network: string; status: "success" | "failed"; details?: unknown }> = [];

  for (const network of networks) {
    try {
      const details = await runAndLogAffiliateSync({ network, mode });
      results.push({ network, status: "success", details });
    } catch (error) {
      results.push({
        network,
        status: "failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return res.status(200).json({
    mode,
    networks,
    results,
  });
}