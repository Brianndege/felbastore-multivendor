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

jest.mock("@/lib/products/visibility", () => ({
  withVisibleVendorProductFilters: jest.fn((where) => where),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    cartItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
  },
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/cart/index";

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "POST",
    body: { productId: "prod_1", quantity: 2 },
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

describe("cart API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
  });

  it("rejects unauthenticated access", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Unauthorized" });
  });

  it("adds new item to cart when product is visible", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({ id: "prod_1" });
    (prisma.cartItem.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.cartItem.create as jest.Mock).mockResolvedValue({ id: "cart_1", quantity: 2 });

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(prisma.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: "user_1", productId: "prod_1", quantity: 2 },
      })
    );
    expect(res.statusCode).toBe(200);
  });

  it("returns 404 for unavailable product", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toEqual({ error: "Product not found or unavailable" });
  });
});
