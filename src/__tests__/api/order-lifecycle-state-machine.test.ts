import {
  canTransitionOrderStatus,
  deriveAggregateOrderStatus,
  isLifecycleStatus,
} from "@/lib/order-lifecycle";

describe("order lifecycle state machine", () => {
  it("allows required linear transitions", () => {
    expect(canTransitionOrderStatus("pending", "confirmed")).toBe(true);
    expect(canTransitionOrderStatus("confirmed", "processing")).toBe(true);
    expect(canTransitionOrderStatus("processing", "shipped")).toBe(true);
    expect(canTransitionOrderStatus("shipped", "in_transit")).toBe(true);
    expect(canTransitionOrderStatus("in_transit", "delivered")).toBe(true);
    expect(canTransitionOrderStatus("delivered", "completed")).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(canTransitionOrderStatus("pending", "shipped")).toBe(false);
    expect(canTransitionOrderStatus("confirmed", "delivered")).toBe(false);
    expect(canTransitionOrderStatus("completed", "processing")).toBe(false);
  });

  it("recognizes controlled statuses", () => {
    expect(isLifecycleStatus("pending")).toBe(true);
    expect(isLifecycleStatus("in_transit")).toBe(true);
    expect(isLifecycleStatus("INVALID")).toBe(false);
  });

  it("derives aggregate order status across vendor fulfillments", () => {
    expect(deriveAggregateOrderStatus(["confirmed", "processing"])).toBe("processing");
    expect(deriveAggregateOrderStatus(["shipped", "in_transit"])).toBe("in_transit");
    expect(deriveAggregateOrderStatus(["delivered", "completed"])).toBe("delivered");
    expect(deriveAggregateOrderStatus(["completed", "completed"])).toBe("completed");
  });
});
