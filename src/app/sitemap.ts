import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_NEXTAUTH_URL || process.env.APP_URL || "https://felbastore.com";

const staticRoutes = [
  "",
  "/products",
  "/categories",
  "/deals",
  "/contact",
  "/help",
  "/terms",
  "/privacy",
  "/vendors",
];

const productIds = ["1", "2", "3", "4", "5", "6", "7", "8"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages = staticRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: route === "" ? 1 : 0.7,
  }));

  const products = productIds.map((id) => ({
    url: `${siteUrl}/products/${id}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...pages, ...products];
}
