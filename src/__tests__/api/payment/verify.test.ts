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

jest.mock("@/lib/payments", () => ({
  verifyPayment: jest.fn(),
}));

jest.mock("@/lib/outbox", () => ({
  enqueueOutboxEvent: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { verifyPayment } from "@/lib/payments";
import { enqueueOutboxEvent } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/payment/verify";

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "POST",
    headers: {},
    body: { paymentId: "pi_1", paymentMethod: "stripe" },
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

describe("payment verify API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
  });

  it("returns 401 for unauthenticated non-webhook requests", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const { req, res } = createReqRes({ headers: {} });
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Unauthorized" });
  });

  it("updates order state on successful payment verification", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });
    (verifyPayment as jest.Mock).mockResolvedValue({ success: true, status: "SUCCESS" });
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: "order_1",
      orderNumber: "ORD-1",
      paymentStatus: "pending",
      userId: "user_1",
    });
    (prisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (enqueueOutboxEvent as jest.Mock).mockResolvedValue(undefined);
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        orderItem: { findMany: jest.fn().mockResolvedValue([]) },
        product: { update: jest.fn() },
        inventoryAlert: { create: jest.fn() },
        notification: { create: jest.fn() },
      };
      return callback(tx);
    });

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order_1", paymentStatus: { notIn: ["paid", "approved"] } },
      data: {
        paymentStatus: "paid",
        status: "confirmed",
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(
      expect.objectContaining({
        success: true,
        status: "SUCCESS",
        orderId: "order_1",
      })
    );
  });

  it("returns 404 when payment verification has no linked order", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });
    (verifyPayment as jest.Mock).mockResolvedValue({ success: true, status: "SUCCESS" });
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toEqual({ success: false, error: "Order not found for this payment" });
  });
});
