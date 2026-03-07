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

jest.mock("@/lib/checkout-eligibility", () => ({
  CheckoutValidationError: class CheckoutValidationError extends Error {
    code: string;
    details?: Record<string, unknown>;

    constructor(message: string, code: string, details?: Record<string, unknown>) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
  evaluateCheckoutEligibility: jest.fn(),
}));

jest.mock("@/lib/outbox", () => ({
  enqueueOutboxEvent: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    cartItem: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      updateMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    orderVendorFulfillment: {
      createMany: jest.fn(),
    },
    orderStatusAudit: {
      createMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    vendor: {
      findMany: jest.fn(),
    },
  },
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { evaluateCheckoutEligibility } from "@/lib/checkout-eligibility";
import { enqueueOutboxEvent } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/orders/create";

const prismaMock = prisma as any;

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "POST",
    headers: {},
    body: {
      shippingAddress: { city: "Nairobi", country: "Kenya" },
      billingAddress: { city: "Nairobi", country: "Kenya" },
      paymentMethod: "card",
    },
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

describe("orders/create API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
    (evaluateCheckoutEligibility as jest.Mock).mockResolvedValue({
      eligible: true,
      paymentOptions: [{ code: "CARD" }],
      vendorCoverage: [],
    });
    (prismaMock.notification.create as jest.Mock).mockResolvedValue({ id: "notif_1" });
    (prismaMock.orderVendorFulfillment.createMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prismaMock.orderStatusAudit.createMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prismaMock.vendor.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.product.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        product: prismaMock.product,
        order: prismaMock.order,
        cartItem: prismaMock.cartItem,
        orderVendorFulfillment: prismaMock.orderVendorFulfillment,
        orderStatusAudit: prismaMock.orderStatusAudit,
      };
      return callback(tx);
    });
  });

  it("returns 401 for unauthenticated users", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when cart is empty", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });
    (prisma.cartItem.findMany as jest.Mock).mockResolvedValue([]);

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: "Cart is empty" });
  });

  it("creates order, writes items, and clears cart", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });
    (prisma.cartItem.findMany as jest.Mock).mockResolvedValue([
      {
        quantity: 2,
        product: {
          id: "prod_1",
          vendorId: "vendor_1",
          name: "Product A",
          price: 50,
          images: ["/a.png"],
          vendor: { id: "vendor_1" },
        },
      },
    ]);
    (prisma.order.create as jest.Mock).mockResolvedValue({
      id: "order_1",
      orderNumber: "ORD-1",
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      totalAmount: 110,
      orderItems: [],
    });
    (prisma.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (enqueueOutboxEvent as jest.Mock).mockResolvedValue(undefined);

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(prisma.order.create).toHaveBeenCalledTimes(1);
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          paymentMethod: "card",
          paymentStatus: "pending",
        }),
      })
    );
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(enqueueOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "order.created",
        entityType: "order",
        entityId: "order_1",
      })
    );
    expect(res.statusCode).toBe(201);
  });
});
