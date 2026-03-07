import { prisma } from "@/lib/prisma";
import { VISIBLE_VENDOR_PRODUCT_WHERE } from "@/lib/products/visibility";

export type UnifiedProductCard = {
  id: string;
  productType: "vendor" | "affiliate";
  isDummy?: boolean;
  name: string;
  description: string;
  image: string;
  price: number;
  currency: string;
  category: string;
  vendorLabel: string;
  rating?: number;
  affiliateNetwork?: string;
};

export async function getUnifiedMarketplaceFeed(options?: { threshold?: number; take?: number }) {
  const threshold = options?.threshold ?? Number(process.env.AFFILIATE_FALLBACK_THRESHOLD || 12);
  const take = options?.take ?? 24;

  const vendorProducts = await prisma.product.findMany({
    where: VISIBLE_VENDOR_PRODUCT_WHERE,
    include: {
      vendor: {
        select: {
          storeName: true,
          name: true,
        },
      },
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take,
  });

  const mappedVendor: UnifiedProductCard[] = vendorProducts.map((product) => ({
    id: product.id,
    productType: "vendor",
    isDummy: product.isDummy,
    name: product.name,
    description: product.description,
    image: product.images[0] || "",
    price: Number(product.price),
    currency: product.currency || "KES",
    category: product.category,
    vendorLabel: product.vendor?.storeName || product.vendor?.name || "Marketplace Vendor",
    rating: product.avgRating ? Number(product.avgRating) : undefined,
  }));

  const shouldBlendAffiliate = mappedVendor.length < threshold;
  let mappedAffiliate: UnifiedProductCard[] = [];

  if (shouldBlendAffiliate) {
    const remainingSlots = Math.max(0, take - mappedVendor.length);
    const affiliateProducts = await prisma.affiliateProduct.findMany({
      where: { isActive: true },
      orderBy: [{ featuredScore: "desc" }, { clickCount: "desc" }, { updatedAt: "desc" }],
      take: Math.max(remainingSlots, Math.min(8, take)),
    });

    mappedAffiliate = affiliateProducts.map((product) => ({
      id: product.id,
      productType: "affiliate",
      isDummy: false,
      name: product.title,
      description: product.description,
      image: product.imageUrl,
      price: Number(product.price),
      currency: product.currency || "USD",
      category: product.category,
      vendorLabel: "External Store",
      affiliateNetwork: product.affiliateNetwork,
    }));
  }

  const featuredAffiliate = mappedAffiliate.slice(0, 4);
  const trendingAffiliate = [...mappedAffiliate]
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, 4);

  return {
    threshold,
    vendorCount: mappedVendor.length,
    usingAffiliateFallback: shouldBlendAffiliate,
    products: [...mappedVendor, ...mappedAffiliate],
    featuredAffiliate,
    trendingAffiliate,
  };
}