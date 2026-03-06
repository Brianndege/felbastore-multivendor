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
    vendorPaymentMethod: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/vendor/payment-methods/index";

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "POST",
    body: { methodKind: "MPESA", label: "Primary", config: { account: "254700000000" } },
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

describe("vendor payment methods API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
  });

  it("returns 401 for non-vendor users", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1", role: "user" } });

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Unauthorized" });
  });

  it("creates payment method in pending_admin state", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "vendor_1", role: "vendor" } });
    (prisma.vendorPaymentMethod.create as jest.Mock).mockResolvedValue({ id: "pm_1", approvalStatus: "pending_admin", isActive: false });

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(prisma.vendorPaymentMethod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorId: "vendor_1",
          methodKind: "MPESA",
          approvalStatus: "pending_admin",
          isActive: false,
        }),
      })
    );
    expect(res.statusCode).toBe(201);
  });
});
