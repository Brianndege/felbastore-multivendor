import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expectedSecret = process.env.AFFILIATE_WEBHOOK_SECRET;
  const providedSecret = req.headers["x-affiliate-webhook-secret"];

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized webhook" });
  }

  const {
    affiliateProductId,
    clickToken,
    externalOrderId,
    amount,
    currency,
    status,
    network,
    metadata,
  } = req.body || {};

  if (!affiliateProductId || !network) {
    return res.status(400).json({ error: "affiliateProductId and network are required" });
  }

  try {
    const conversion = await prisma.affiliateConversion.create({
      data: {
        affiliateProductId,
        clickToken: clickToken || null,
        externalOrderId: externalOrderId || null,
        amount: typeof amount === "number" ? amount : null,
        currency: currency || "USD",
        status: status || "pending",
        network,
        metadata: metadata ? JSON.stringify(metadata) : null,
        convertedAt: new Date(),
      },
    });

    return res.status(200).json({ success: true, conversionId: conversion.id });
  } catch (error) {
    console.error("[affiliate-conversion-webhook]", error);
    return res.status(500).json({ error: "Unable to record affiliate conversion" });
  }
}