export type TenantScopedRequest = {
  tenantId: string;
  actorId: string;
  actorRole: string;
  ipAddress?: string;
  userAgent?: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
};

export type DateRange = {
  from: string;
  to: string;
};

export type RealtimeMetric = {
  key: string;
  value: number;
  ts: string;
};

export type ServiceHealth = {
  service: string;
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
};