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

jest.mock("@/lib/outbox", () => ({
  enqueueOutboxEvent: jest.fn(),
}));

jest.mock("@/lib/email", () => ({
  sendOrderStatusEmailToUser: jest.fn(),
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/vendor/orders/[id]/status";

const prismaMock = prisma as any;

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "PATCH",
    query: { id: "order_1" },
    body: { status: "processing" },
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

describe("vendor order lifecycle status API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "vendor_1", role: "vendor" } });
    (prismaMock.order.findFirst as jest.Mock).mockResolvedValue({
      id: "order_1",
      orderNumber: "ORD-1",
      userId: "user_1",
      user: { email: "test@example.com", name: "Test User" },
    });
    (prismaMock.orderVendorFulfillment.findUnique as jest.Mock).mockResolvedValue({
      orderId: "order_1",
      vendorId: "vendor_1",
      orderStatus: "CONFIRMED",
      shippingStatus: "PENDING",
    });
    (prismaMock.orderVendorFulfillment.update as jest.Mock).mockResolvedValue({
      orderId: "order_1",
      orderStatus: "PROCESSING",
      shippingStatus: "PENDING",
      trackingNumber: null,
      shippingProvider: null,
      trackingUrl: null,
      estimatedDeliveryAt: null,
    });
  });

  it("updates fulfillment status with valid transition", async () => {
    const { req, res } = createReqRes({ body: { status: "processing" } });
    await handler(req, res);

    expect(prismaMock.orderVendorFulfillment.update).toHaveBeenCalled();
    expect(prismaMock.orderStatusAudit.create).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("rejects invalid transition", async () => {
    (prismaMock.orderVendorFulfillment.findUnique as jest.Mock).mockResolvedValue({
      orderId: "order_1",
      vendorId: "vendor_1",
      orderStatus: "PENDING",
      shippingStatus: "PENDING",
    });

    const { req, res } = createReqRes({ body: { status: "delivered" } });
    await handler(req, res);

    expect(res.statusCode).toBe(400);
  });

  it("requires tracking details when shipping", async () => {
    (prismaMock.orderVendorFulfillment.findUnique as jest.Mock).mockResolvedValue({
      orderId: "order_1",
      vendorId: "vendor_1",
      orderStatus: "PROCESSING",
      shippingStatus: "PENDING",
    });

    const { req, res } = createReqRes({ body: { status: "shipped" } });
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: "shippingProvider and trackingNumber are required when marking as shipped" });
  });
});
