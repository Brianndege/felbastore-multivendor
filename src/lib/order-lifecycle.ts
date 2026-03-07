export const ORDER_LIFECYCLE_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "in_transit",
  "delivered",
  "completed",
  "cancelled",
  "refunded",
] as const;

export type OrderLifecycleStatus = (typeof ORDER_LIFECYCLE_STATUSES)[number];

export type LifecycleActorRole = "customer" | "vendor" | "admin" | "system";

export const STATUS_TRANSITIONS: Record<OrderLifecycleStatus, OrderLifecycleStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["in_transit", "delivered", "refunded"],
  in_transit: ["delivered", "refunded"],
  delivered: ["completed", "refunded"],
  completed: [],
  cancelled: [],
  refunded: [],
};

export function isLifecycleStatus(value: string): value is OrderLifecycleStatus {
  return ORDER_LIFECYCLE_STATUSES.includes(value as OrderLifecycleStatus);
}

export function canTransitionOrderStatus(currentStatus: string, nextStatus: string): boolean {
  if (!isLifecycleStatus(currentStatus) || !isLifecycleStatus(nextStatus)) {
    return false;
  }

  if (currentStatus === nextStatus) {
    return true;
  }

  return STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function getLifecycleTimestampField(status: OrderLifecycleStatus): string | null {
  switch (status) {
    case "confirmed":
      return "confirmedAt";
    case "processing":
      return "processingAt";
    case "shipped":
      return "shippedAt";
    case "in_transit":
      return "inTransitAt";
    case "delivered":
      return "deliveredAt";
    case "completed":
      return "completedAt";
    case "cancelled":
      return "cancelledAt";
    case "refunded":
      return "refundedAt";
    default:
      return null;
  }
}

export function buildTimelineCopy(status: OrderLifecycleStatus): string {
  switch (status) {
    case "pending":
      return "Order Placed - Waiting for Vendor Confirmation";
    case "confirmed":
      return "Vendor confirmed your order and is preparing it.";
    case "processing":
      return "Your order is being prepared by the vendor.";
    case "shipped":
      return "Your order has been shipped.";
    case "in_transit":
      return "Your order is in transit.";
    case "delivered":
      return "Your order has arrived.";
    case "completed":
      return "Order completed and payout released.";
    case "cancelled":
      return "Order was cancelled.";
    case "refunded":
      return "Order was refunded.";
    default:
      return "Order update";
  }
}

export function deriveAggregateOrderStatus(statuses: string[]): OrderLifecycleStatus {
  const normalized = statuses.filter(isLifecycleStatus);
  if (normalized.length === 0) {
    return "pending";
  }

  // Most critical terminal states first.
  if (normalized.some((status) => status === "refunded")) return "refunded";
  if (normalized.some((status) => status === "cancelled")) return "cancelled";
  if (normalized.every((status) => status === "completed")) return "completed";
  if (normalized.every((status) => status === "delivered" || status === "completed")) return "delivered";
  if (normalized.some((status) => status === "in_transit")) return "in_transit";
  if (normalized.some((status) => status === "shipped")) return "shipped";
  if (normalized.some((status) => status === "processing")) return "processing";
  if (normalized.some((status) => status === "confirmed")) return "confirmed";

  return "pending";
}
