import type { NextApiRequest, NextApiResponse } from "next";

jest.mock("@/lib/auth/rate-limit", () => ({
  applyAuthRateLimit: jest.fn(),
}));

jest.mock("@/lib/auth/security", () => ({
  hashIdentifier: jest.fn(() => "ip_hash"),
}));

jest.mock("@/lib/admin/security-auth", () => ({
  createAdminAccessKey: jest.fn(),
  createAdminPassword: jest.fn(),
  ensureAdminSecuritySchemaCompatibility: jest.fn(),
  isAllowedAdminGenerator: jest.fn(),
  logAdminSecurityEvent: jest.fn(),
}));

import { applyAuthRateLimit } from "@/lib/auth/rate-limit";
import {
  createAdminAccessKey,
  createAdminPassword,
  ensureAdminSecuritySchemaCompatibility,
  isAllowedAdminGenerator,
  logAdminSecurityEvent,
} from "@/lib/admin/security-auth";
import accessHandler from "@/pages/api/admin/browser/generate-access-link";
import passwordHandler from "@/pages/api/admin/browser/generate-password-link";

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "GET",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      ...input.headers,
    },
    query: {},
    socket: { remoteAddress: "127.0.0.1" },
    ...input,
  } as unknown as NextApiRequest;

  const res: {
    statusCode: number;
    payload: unknown;
    headers: Record<string, string>;
    status: (code: number) => unknown;
    send: (payload: unknown) => unknown;
    setHeader: (name: string, value: string) => unknown;
  } = {
    statusCode: 200,
    payload: undefined,
    headers: {},
    setHeader(name: string, value: string) {
      res.headers[name] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    send(payload: unknown) {
      res.payload = payload;
      return res;
    },
  };

  return { req, res: res as unknown as NextApiResponse & { statusCode: number; payload: unknown; headers: Record<string, string> } };
}

describe("browser helper links", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_LOGIN_KEY = "bootstrap-key";
    process.env.ADMIN_DEFAULT_EMAIL = "admin@felbastore.local";
    process.env.APP_URL = "https://felbastore.co.ke";
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.NEXTAUTH_URL = "";

    (applyAuthRateLimit as jest.Mock).mockReturnValue({ allowed: true });
    (isAllowedAdminGenerator as jest.Mock).mockReturnValue(true);
    (ensureAdminSecuritySchemaCompatibility as jest.Mock).mockResolvedValue(undefined);
    (logAdminSecurityEvent as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns plain login url from browser-friendly access endpoint", async () => {
    (createAdminAccessKey as jest.Mock).mockResolvedValue({ rawKey: "abc123" });

    const { req, res } = createReqRes({
      query: {
        k: "bootstrap-key",
        email: "admin@felbastore.local",
      },
    });

    await accessHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toBe("https://felbastore.co.ke/admin/login/abc123");
    expect(res.headers["Cache-Control"]).toBe("no-store, no-cache, must-revalidate, proxy-revalidate");
  });

  it("returns plain one-time password from browser-friendly password endpoint", async () => {
    (createAdminPassword as jest.Mock).mockResolvedValue({ rawPassword: "A9#d82!3kd@29fj" });

    const { req, res } = createReqRes({
      query: {
        k: "bootstrap-key",
        email: "admin@felbastore.local",
      },
    });

    await passwordHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toBe("A9#d82!3kd@29fj");
    expect(res.headers["Cache-Control"]).toBe("no-store, no-cache, must-revalidate, proxy-revalidate");
  });

  it("rejects bad bootstrap key", async () => {
    const { req, res } = createReqRes({
      query: {
        k: "wrong-key",
        email: "admin@felbastore.local",
      },
    });

    await accessHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toBe("Unauthorized");
  });
});
