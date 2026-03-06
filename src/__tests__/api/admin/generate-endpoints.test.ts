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

jest.mock("@/lib/auth/rate-limit", () => ({
  applyAuthRateLimit: jest.fn(),
}));

jest.mock("@/lib/auth/security", () => ({
  hashIdentifier: jest.fn(() => "hashed_ip"),
}));

jest.mock("@/lib/admin/security-auth", () => ({
  createAdminAccessKey: jest.fn(),
  createAdminPassword: jest.fn(),
  ensureAdminSecuritySchemaCompatibility: jest.fn(),
  isAllowedAdminGenerator: jest.fn(),
  logAdminSecurityEvent: jest.fn(),
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { applyAuthRateLimit } from "@/lib/auth/rate-limit";
import {
  createAdminAccessKey,
  createAdminPassword,
  ensureAdminSecuritySchemaCompatibility,
  isAllowedAdminGenerator,
  logAdminSecurityEvent,
} from "@/lib/admin/security-auth";
import generateAccessHandler from "@/pages/api/admin/generate-access";
import generatePasswordHandler from "@/pages/api/admin/generate-password";

function createReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "POST",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
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

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("admin generation endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNodeEnv("test");
    process.env.ADMIN_LOGIN_KEY = "bootstrap-key";
    process.env.ADMIN_DEFAULT_EMAIL = "admin@felbastore.local";
    process.env.APP_URL = "";
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.NEXTAUTH_URL = "";

    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
    (applyAuthRateLimit as jest.Mock).mockReturnValue({ allowed: true });
    (isAllowedAdminGenerator as jest.Mock).mockReturnValue(true);
    (ensureAdminSecuritySchemaCompatibility as jest.Mock).mockResolvedValue(undefined);
    (logAdminSecurityEvent as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 500 in production when ADMIN_DEFAULT_EMAIL is missing", async () => {
    setNodeEnv("production");
    delete process.env.ADMIN_DEFAULT_EMAIL;

    const { req, res } = createReqRes();
    await generateAccessHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ error: "ADMIN_DEFAULT_EMAIL must be configured in production" });
  });

  it("supports bootstrap access key generation without session", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (createAdminAccessKey as jest.Mock).mockResolvedValue({
      rawKey: "abc123",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const { req, res } = createReqRes({
      headers: {
        host: "felbastore.co.ke",
        "x-forwarded-proto": "https",
        "x-admin-login-key": "bootstrap-key",
      },
      body: {
        email: "admin@felbastore.local",
      },
    });

    await generateAccessHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("no-store, no-cache, must-revalidate, proxy-revalidate");
    expect(res.payload).toEqual({
      loginUrl: "https://felbastore.co.ke/admin/login/abc123",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
  });

  it("requires trusted app base URL in production for login link generation", async () => {
    setNodeEnv("production");
    process.env.APP_URL = "";
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.NEXTAUTH_URL = "";
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        role: "admin",
        email: "admin@felbastore.local",
        adminSecurityVerified: true,
        adminAccessKeyId: "key_1",
      },
    });
    (createAdminAccessKey as jest.Mock).mockResolvedValue({
      rawKey: "abc123",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const { req, res } = createReqRes();
    await generateAccessHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ error: "APP_URL or NEXT_PUBLIC_APP_URL must be configured in production" });
  });

  it("rejects generation when unauthorized", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const { req, res } = createReqRes({
      body: { email: "admin@felbastore.local" },
      headers: { "x-admin-login-key": "wrong-key" },
    });

    await generatePasswordHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Unauthorized" });
  });

  it("returns generated one-time password for secure admin session", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        role: "admin",
        email: "admin@felbastore.local",
        adminSecurityVerified: true,
        adminAccessKeyId: "key_1",
      },
    });
    (createAdminPassword as jest.Mock).mockResolvedValue({
      rawPassword: "A9#d82!3kd@29fj",
      expiresAt: new Date("2030-01-01T01:00:00.000Z"),
    });

    const { req, res } = createReqRes();
    await generatePasswordHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("no-store, no-cache, must-revalidate, proxy-revalidate");
    expect(res.payload).toEqual({
      password: "A9#d82!3kd@29fj",
      expiresAt: "2030-01-01T01:00:00.000Z",
    });
  });
});
