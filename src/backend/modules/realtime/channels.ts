export const realtimeChannels = {
  adminGlobal: "admin.global",
  adminTenant: (tenantId: string) => `admin.tenant.${tenantId}`,
  vendor: (vendorId: string) => `vendor.${vendorId}`,
  user: (userId: string) => `user.${userId}`,
  fraudAlerts: (tenantId: string) => `fraud.${tenantId}`,
} as const;

export type RealtimeChannelKey = keyof typeof realtimeChannels;