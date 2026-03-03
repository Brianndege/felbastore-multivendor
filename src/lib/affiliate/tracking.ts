import { createRandomToken, getClientIpAddress, hashIdentifier } from "@/lib/auth/security";
import { prisma } from "@/lib/prisma";

export function buildTrackedAffiliateUrl(input: { baseUrl: string; clickToken: string; productId: string; network: string }) {
  const url = new URL(input.baseUrl);
  url.searchParams.set("utm_source", "felbastore");
  url.searchParams.set("utm_medium", "affiliate");
  url.searchParams.set("utm_campaign", "marketplace_fallback");
  url.searchParams.set("aff_click", input.clickToken);
  url.searchParams.set("aff_network", input.network);
  url.searchParams.set("aff_product", input.productId);
  return url.toString();
}

export async function logAffiliateClick(input: {
  affiliateProductId: string;
  forwardedFor?: string | string[];
  userAgent?: string;
  referrer?: string;
  userId?: string;
}) {
  const clickToken = createRandomToken(12);
  const ipAddress = getClientIpAddress(input.forwardedFor);

  await prisma.affiliateClick.create({
    data: {
      affiliateProductId: input.affiliateProductId,
      clickToken,
      ipHash: ipAddress === "unknown" ? null : hashIdentifier(ipAddress),
      userAgent: input.userAgent || null,
      referrer: input.referrer || null,
      userId: input.userId || null,
    },
  });

  await prisma.affiliateProduct.update({
    where: { id: input.affiliateProductId },
    data: {
      clickCount: { increment: 1 },
    },
  });

  return clickToken;
}