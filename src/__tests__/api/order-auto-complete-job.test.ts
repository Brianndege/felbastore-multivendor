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
    orderVendorFulfillment: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    orderStatusAudit: {
      createMany: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/internal/jobs/order-auto-complete";

const prismaMock = prisma as any;

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "POST",
    headers: {},
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

describe("internal/jobs/order-auto-complete API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "admin_1", role: "admin" } });
    (prismaMock.orderVendorFulfillment.findMany as jest.Mock).mockResolvedValue([
      {
        orderId: "order_1",
        vendorId: "vendor_1",
        order: {
          orderNumber: "ORD-1",
          userId: "user_1",
        },
      },
    ]);
    (prismaMock.orderStatusAudit.createMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prismaMock.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prismaMock.$transaction as jest.Mock).mockResolvedValue([]);
    (prismaMock.orderVendorFulfillment.update as jest.Mock).mockResolvedValue({ orderStatus: "COMPLETED" });
  });

  it("auto-completes eligible delivered fulfillments", async () => {
    const { req, res } = createReqRes();
    await handler(req, res);

    expect(prismaMock.orderVendorFulfillment.findMany).toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.orderStatusAudit.createMany).toHaveBeenCalled();
    expect(prismaMock.notification.createMany).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({ ok: true, completed: 1 }));
  });
});
