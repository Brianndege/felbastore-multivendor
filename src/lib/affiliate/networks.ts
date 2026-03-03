export type IntegrationMode = "api" | "feed" | "deeplink";

export type AffiliateNetworkConfig = {
  key: string;
  label: string;
  category: "global" | "ecommerce" | "tech_saas";
  supportedModes: IntegrationMode[];
  defaultCommissionRate: number;
};

export const AFFILIATE_NETWORKS: AffiliateNetworkConfig[] = [
  { key: "AMAZON_ASSOCIATES", label: "Amazon Associates", category: "global", supportedModes: ["api", "feed", "deeplink"], defaultCommissionRate: 4 },
  { key: "CJ_AFFILIATE", label: "CJ Affiliate", category: "global", supportedModes: ["api", "feed", "deeplink"], defaultCommissionRate: 6 },
  { key: "SHAREASALE", label: "ShareASale", category: "global", supportedModes: ["api", "feed", "deeplink"], defaultCommissionRate: 7 },
  { key: "RAKUTEN_ADVERTISING", label: "Rakuten Advertising", category: "global", supportedModes: ["api", "feed", "deeplink"], defaultCommissionRate: 6 },
  { key: "IMPACT", label: "Impact.com", category: "global", supportedModes: ["api", "feed", "deeplink"], defaultCommissionRate: 8 },
  { key: "AWIN", label: "Awin", category: "global", supportedModes: ["api", "feed", "deeplink"], defaultCommissionRate: 6 },
  { key: "SHOPIFY", label: "Shopify Affiliate Stores", category: "ecommerce", supportedModes: ["feed", "deeplink"], defaultCommissionRate: 10 },
  { key: "EBAY_PARTNER_NETWORK", label: "eBay Partner Network", category: "ecommerce", supportedModes: ["api", "feed", "deeplink"], defaultCommissionRate: 3 },
  { key: "WALMART_AFFILIATE", label: "Walmart Affiliate", category: "ecommerce", supportedModes: ["api", "feed", "deeplink"], defaultCommissionRate: 4 },
  { key: "ALIEXPRESS_PORTALS", label: "AliExpress Portals", category: "ecommerce", supportedModes: ["feed", "deeplink"], defaultCommissionRate: 8 },
  { key: "ETSY_AFFILIATE", label: "Etsy Affiliate", category: "ecommerce", supportedModes: ["deeplink", "feed"], defaultCommissionRate: 4 },
  { key: "ENVATO", label: "Envato", category: "tech_saas", supportedModes: ["feed", "deeplink"], defaultCommissionRate: 12 },
  { key: "CLICKBANK", label: "ClickBank", category: "tech_saas", supportedModes: ["api", "feed", "deeplink"], defaultCommissionRate: 20 },
];