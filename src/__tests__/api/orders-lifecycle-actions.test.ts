import type { NextApiRequest, NextApiResponse } from "next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/pages/api/auth/[...nextauth]", () => ({
  authOptions: {},
}));

jest.mock("@/lib/csrf", () => ({
  enforceCsrfOrigin: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findFirst: jest.fn(),
    },
    orderVendorFulfillment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    orderStatusAudit: {
      create: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/orders/[id]/lifecycle";

const prismaMock = prisma as any;

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "POST",
    query: { id: "order_1" },
    body: { vendorId: "vendor_1", action: "confirm_receipt" },
    ...input,
  } as unknown as NextApiRequest;

  const res: {
    statusCode: number;
    payload: unknown;
    status: (code: number) => unknown;
    json: (payload: unknown) => unknown;
  } = {
    statusCode: 200,
    payload: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.payload = payload;
      return res;
    },
  };

  return { req, res: res as unknown as NextApiResponse & { statusCode: number; payload: unknown } };
}

describe("orders/[id]/lifecycle API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });
    (prismaMock.order.findFirst as jest.Mock).mockResolvedValue({ id: "order_1", orderNumber: "ORD-1", userId: "user_1" });
    (prismaMock.orderVendorFulfillment.findUnique as jest.Mock).mockResolvedValue({
      orderId: "order_1",
      vendorId: "vendor_1",
      orderStatus: "DELIVERED",
      completedAt: null,
    });
    (prismaMock.orderVendorFulfillment.update as jest.Mock).mockResolvedValue({
      orderStatus: "COMPLETED",
      completedAt: new Date("2030-01-01T00:00:00.000Z"),
      refundedAt: null,
      payoutFrozenAt: null,
      disputeOpenedAt: null,
    });
    (prismaMock.orderStatusAudit.create as jest.Mock).mockResolvedValue({ id: "audit_1" });
    (prismaMock.notification.create as jest.Mock).mockResolvedValue({ id: "notif_1" });
  });

  it("confirms receipt and completes fulfillment", async () => {
    const { req, res } = createReqRes({ body: { vendorId: "vendor_1", action: "confirm_receipt" } });
    await handler(req, res);

    expect(prismaMock.orderVendorFulfillment.update).toHaveBeenCalled();
    expect(prismaMock.orderStatusAudit.create).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("opens dispute and freezes payout", async () => {
    (prismaMock.orderVendorFulfillment.update as jest.Mock).mockResolvedValue({
      orderStatus: "DELIVERED",
      disputeOpenedAt: new Date("2030-01-01T00:00:00.000Z"),
      payoutFrozenAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const { req, res } = createReqRes({ body: { vendorId: "vendor_1", action: "open_dispute", reason: "Item damaged" } });
    await handler(req, res);

    expect(prismaMock.orderVendorFulfillment.update).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("rejects invalid action", async () => {
    const { req, res } = createReqRes({ body: { vendorId: "vendor_1", action: "invalid" } });
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: "Unsupported lifecycle action" });
  });
});
