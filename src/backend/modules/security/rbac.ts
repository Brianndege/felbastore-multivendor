export const rolePermissions: Record<string, string[]> = {
  super_admin: ["*"],
  finance_admin: [
    "finance.read",
    "finance.refund",
    "finance.chargeback",
    "finance.payout.manage",
  ],
  risk_admin: [
    "security.read",
    "security.fraud.review",
    "security.user.restrict",
    "security.ip.block",
  ],
  support_admin: [
    "users.read",
    "users.note.write",
    "orders.read",
    "orders.refund.request",
    "users.impersonate",
  ],
  vendor_owner: [
    "vendor.dashboard.read",
    "vendor.products.manage",
    "vendor.orders.manage",
    "vendor.payout.read",
    "vendor.marketing.manage",
  ],
  vendor_manager: [
    "vendor.dashboard.read",
    "vendor.products.manage",
    "vendor.orders.manage",
  ],
  vendor_staff: ["vendor.orders.manage", "vendor.reviews.manage"],
  customer: [
    "user.orders.read",
    "user.wishlist.manage",
    "user.referrals.read",
    "user.reviews.write",
  ],
  affiliate: ["growth.affiliate.read", "growth.affiliate.links.manage"],
  influencer: ["growth.influencer.read", "growth.influencer.links.manage"],
  ambassador: ["growth.ambassador.read", "growth.ambassador.challenges.complete"],
};

export const sensitiveActions = new Set<string>([
  "finance.refund",
  "finance.chargeback",
  "users.impersonate",
  "security.user.restrict",
  "security.ip.block",
]);