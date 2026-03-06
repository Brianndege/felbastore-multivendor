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
  hashIdentifier: jest.fn(() => "ip_hash"),
}));

jest.mock("@/lib/admin/security-auth", () => ({
  createAdminLoginBundle: jest.fn(),
  ensureAdminSecuritySchemaCompatibility: jest.fn(),
  isAllowedAdminGenerator: jest.fn(),
  logAdminSecurityEvent: jest.fn(),
}));

import { getServerSession } from "next-auth/next";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { applyAuthRateLimit } from "@/lib/auth/rate-limit";
import {
  createAdminLoginBundle,
  ensureAdminSecuritySchemaCompatibility,
  isAllowedAdminGenerator,
  logAdminSecurityEvent,
} from "@/lib/admin/security-auth";
import generateBundleHandler from "@/pages/api/admin/generate-login-bundle";
import browserGenerateBundleHandler from "@/pages/api/admin/browser/generate-login-bundle";

function createJsonReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "POST",
    headers: {
      host: "felbastore.co.ke",
      "x-forwarded-proto": "https",
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
    json(payload: unknown) {
      res.payload = payload;
      return res;
    },
  };

  return { req, res: res as unknown as NextApiResponse & { statusCode: number; payload: unknown; headers: Record<string, string> } };
}

function createBrowserReqRes(input: Partial<NextApiRequest> = {}) {
  const req = {
    method: "GET",
    headers: {
      host: "felbastore.co.ke",
      "x-forwarded-proto": "https",
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
    json: (payload: unknown) => unknown;
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
    json(payload: unknown) {
      res.payload = payload;
      return res;
    },
  };

  return { req, res: res as unknown as NextApiResponse & { statusCode: number; payload: unknown; headers: Record<string, string> } };
}

describe("admin login bundle generation flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "test";
    process.env.ADMIN_DEFAULT_EMAIL = "ndegebrian4@gmail.com";
    process.env.ADMIN_LOGIN_KEY = "bootstrap-key";
    process.env.APP_URL = "https://felbastore.co.ke";
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.NEXT_PUBLIC_NEXTAUTH_URL = "";
    process.env.NEXTAUTH_URL = "";

    (enforceCsrfOrigin as jest.Mock).mockReturnValue(true);
    (applyAuthRateLimit as jest.Mock).mockReturnValue({
      allowed: true,
      attempts: 1,
      max: 1,
      retryAfterSeconds: 900,
      remaining: 0,
    });
    (ensureAdminSecuritySchemaCompatibility as jest.Mock).mockResolvedValue(undefined);
    (isAllowedAdminGenerator as jest.Mock).mockReturnValue(true);
    (logAdminSecurityEvent as jest.Mock).mockResolvedValue(undefined);
    (createAdminLoginBundle as jest.Mock).mockResolvedValue({
      rawKey: "key123",
      rawPassword: "Pass#123456",
      expiresAt: new Date("2030-01-01T00:15:00.000Z"),
    });
  });

  it("generates bundle via secure session endpoint with shared expiry", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        role: "admin",
        email: "ndegebrian4@gmail.com",
        adminSecurityVerified: true,
        adminAccessKeyId: "key_1",
      },
    });

    const { req, res } = createJsonReqRes();
    await generateBundleHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      loginUrl: "https://felbastore.co.ke/admin/login/key123?email=ndegebrian4%40gmail.com",
      password: "Pass#123456",
      expiresAt: "2030-01-01T00:15:00.000Z",
      attempts: 1,
      maxAttempts: 1,
      retryAfterSeconds: 900,
    });
  });

  it("returns lockout metadata when bundle generation is on cooldown", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        role: "admin",
        email: "ndegebrian4@gmail.com",
        adminSecurityVerified: true,
        adminAccessKeyId: "key_1",
      },
    });
    (applyAuthRateLimit as jest.Mock).mockReturnValue({
      allowed: false,
      attempts: 2,
      max: 1,
      retryAfterSeconds: 731,
      remaining: 0,
    });

    const { req, res } = createJsonReqRes();
    await generateBundleHandler(req, res);

    expect(res.statusCode).toBe(429);
    expect(res.payload).toEqual({
      error: "Generation is locked for 15 minutes after each bundle.",
      attempts: 2,
      maxAttempts: 1,
      retryAfterSeconds: 731,
    });
  });

  it("supports bootstrap browser bundle generation in one call", async () => {
    const { req, res } = createBrowserReqRes({
      query: {
        k: "bootstrap-key",
        email: "ndegebrian4@gmail.com",
      },
    });

    await browserGenerateBundleHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      loginUrl: "https://felbastore.co.ke/admin/login/key123?email=ndegebrian4%40gmail.com",
      password: "Pass#123456",
      expiresAt: "2030-01-01T00:15:00.000Z",
      attempts: 1,
      maxAttempts: 1,
      retryAfterSeconds: 900,
    });
  });
});
