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

jest.mock("@/lib/product-activity", () => ({
  logAdminProductModerationActivity: jest.fn(),
  logVendorProductActivity: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { logAdminProductModerationActivity, logVendorProductActivity } from "@/lib/product-activity";
import handler from "@/pages/api/admin/products/[id]/review";

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "POST",
    query: { id: "prod_1" },
    body: { action: "approve" },
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

describe("admin product review API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
  });

  it("returns 401 for non-admin access", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "vendor_1", role: "vendor" } });

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid action", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "admin_1", role: "admin" } });

    const { req, res } = createReqRes({ body: { action: "publish" } });
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: "Action must be approve or reject" });
  });

  it("approves product and creates vendor notification", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "admin_1", role: "admin" } });
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: "prod_1",
      name: "Product A",
      vendorId: "vendor_1",
      vendor: { id: "vendor_1", name: "Vendor", storeName: "Store" },
    });
    (prisma.product.update as jest.Mock).mockResolvedValue({ id: "prod_1", isApproved: true, status: "active", workflowStatus: "APPROVED" });
    (prisma.notification.create as jest.Mock).mockResolvedValue({ id: "noti_1" });

    const { req, res } = createReqRes({ body: { action: "approve" } });
    await handler(req, res);

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: "prod_1" },
      data: { isApproved: true, status: "active", workflowStatus: "APPROVED" },
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(logVendorProductActivity).toHaveBeenCalledTimes(1);
    expect(logAdminProductModerationActivity).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });
});
