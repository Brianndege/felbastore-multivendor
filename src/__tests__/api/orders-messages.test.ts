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
      findUnique: jest.fn(),
    },
    orderConversationMessage: {
      findMany: jest.fn(),
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
import handler from "@/pages/api/orders/[id]/messages";

const prismaMock = prisma as any;

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "GET",
    query: { id: "order_1" },
    body: {},
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

describe("orders/[id]/messages API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
    (prismaMock.order.findUnique as jest.Mock).mockResolvedValue({
      id: "order_1",
      orderNumber: "ORD-1",
      userId: "user_1",
      vendorFulfillments: [{ vendorId: "vendor_1" }],
    });
    (prismaMock.notification.create as jest.Mock).mockResolvedValue({ id: "notif_1" });
  });

  it("allows customer to send message to vendor", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });
    (prismaMock.orderConversationMessage.create as jest.Mock).mockResolvedValue({
      id: "msg_1",
      vendorId: "vendor_1",
      customerId: "user_1",
      senderRole: "user",
      senderId: "user_1",
      message: "Please confirm ETA",
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const { req, res } = createReqRes({
      method: "POST",
      body: { vendorId: "vendor_1", message: "Please confirm ETA" },
    });

    await handler(req, res);

    expect(prismaMock.orderConversationMessage.create).toHaveBeenCalled();
    expect(prismaMock.notification.create).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it("scopes vendor fetch to own vendorId", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "vendor_1", role: "vendor" } });
    (prismaMock.orderConversationMessage.findMany as jest.Mock).mockResolvedValue([
      {
        id: "msg_1",
        vendorId: "vendor_1",
        customerId: "user_1",
        senderRole: "user",
        senderId: "user_1",
        message: "Update?",
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
        vendor: { id: "vendor_1", name: "Vendor", storeName: "Store" },
        customer: { id: "user_1", name: "Customer", email: "customer@example.com" },
      },
    ]);

    const { req, res } = createReqRes({ method: "GET" });
    await handler(req, res);

    expect(prismaMock.orderConversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ vendorId: "vendor_1" }) })
    );
    expect(res.statusCode).toBe(200);
  });
});
