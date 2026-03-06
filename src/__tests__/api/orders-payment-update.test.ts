import type { NextApiRequest, NextApiResponse } from "next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/pages/api/auth/[...nextauth]", () => ({
  authOptions: {},
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/orders/[id]/payment";

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "PUT",
    query: { id: "order_1" },
    body: { paymentIntentId: "pi_1" },
    ...input,
  } as unknown as NextApiRequest;

  const res: {
    statusCode: number;
    payload: unknown;
    status: (code: number) => unknown;
    json: (payload: unknown) => unknown;
    end: () => unknown;
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
    end() {
      return res;
    },
  };

  return { req, res: res as unknown as NextApiResponse & { statusCode: number; payload: unknown } };
}

describe("orders/[id]/payment API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects client-provided paymentStatus", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });

    const { req, res } = createReqRes({ body: { paymentIntentId: "pi_1", paymentStatus: "paid" } });
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: "paymentStatus cannot be set by client" });
  });

  it("updates only paymentIntentId for owner order", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({ id: "order_1", paymentStatus: "pending", userId: "user_1" });
    (prisma.order.update as jest.Mock).mockResolvedValue({ id: "order_1", paymentIntentId: "pi_1" });

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { paymentIntentId: "pi_1" },
    });
    expect(res.statusCode).toBe(200);
  });
});
