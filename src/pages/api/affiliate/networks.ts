import type { NextApiRequest, NextApiResponse } from "next";
import { AFFILIATE_NETWORKS } from "@/lib/affiliate/networks";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({
    networks: AFFILIATE_NETWORKS,
    integrationOptions: {
      optionA: "API sync where available (daily cron)",
      optionB: "XML/CSV product feed ingestion and normalization",
      optionC: "Deep-link only mode without full product import",
    },
  });
}