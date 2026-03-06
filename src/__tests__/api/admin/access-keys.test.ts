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

jest.mock("@/lib/admin/security-auth", () => ({
  ensureAdminSecuritySchemaCompatibility: jest.fn(),
  listAdminAccessKeys: jest.fn(),
  logAdminSecurityEvent: jest.fn(),
  revokeAdminAccessKeyById: jest.fn(),
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import {
  ensureAdminSecuritySchemaCompatibility,
  listAdminAccessKeys,
  logAdminSecurityEvent,
  revokeAdminAccessKeyById,
} from "@/lib/admin/security-auth";
import handler from "@/pages/api/admin/security/access-keys";

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "GET",
    headers: {
      "x-forwarded-for": "127.0.0.1",
      ...input.headers,
    },
    body: {},
    socket: { remoteAddress: "127.0.0.1" },
    ...input,
  } as unknown as NextApiRequest;

  const res: {
    statusCode: number;
    payload: unknown;
    headers: Record<string, string>;
    status: (code: number) => unknown;
    json: (payload: unknown) => unknown;
    setHeader: (name: string, value: string) => unknown;
  } = {
    statusCode: 200,
    payload: undefined as unknown,
    headers: {},
    setHeader(name: string, value: string) {
      res.headers[name] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.payload = payload;
      return res;
    },
  };

  return { req, res: res as unknown as NextApiResponse & { statusCode: number; payload: unknown; headers: Record<string, string> } };
}

describe("admin access keys API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ensureAdminSecuritySchemaCompatibility as jest.Mock).mockResolvedValue(undefined);
    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
    (logAdminSecurityEvent as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 401 for unauthenticated requests", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const { req, res } = createReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Unauthorized" });
  });

  it("returns access keys for authenticated admin", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { role: "admin", email: "admin@felbastore.local" },
    });
    (listAdminAccessKeys as jest.Mock).mockResolvedValue([{ id: "key_1", used: false }]);

    const { req, res } = createReqRes({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("no-store, no-cache, must-revalidate, proxy-revalidate");
    expect(res.payload).toEqual({ keys: [{ id: "key_1", used: false }] });
  });

  it("requires keyId when revoking", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { role: "admin", email: "admin@felbastore.local" },
    });

    const { req, res } = createReqRes({ method: "DELETE", body: {} });
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: "keyId is required" });
  });

  it("revokes key and logs event", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { role: "admin", email: "admin@felbastore.local" },
    });
    (revokeAdminAccessKeyById as jest.Mock).mockResolvedValue(true);

    const { req, res } = createReqRes({ method: "DELETE", body: { keyId: "key_1" } });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ revoked: true });
    expect(logAdminSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "admin@felbastore.local",
        success: true,
        event: "key_revoked",
      })
    );
  });
});
