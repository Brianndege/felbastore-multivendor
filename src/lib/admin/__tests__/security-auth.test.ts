import bcrypt from "bcryptjs";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  consumeAdminPassword,
  generateAdminPassword,
  isAllowedAdminGenerator,
} from "@/lib/admin/security-auth";

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("admin security auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ADMIN_DEFAULT_EMAIL;
    setNodeEnv("test");
  });

  it("generates strong passwords with required character groups", () => {
    const password = generateAdminPassword();

    expect(password.length).toBeGreaterThanOrEqual(16);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    expect(/[!@#$%^&*()\-_=+\[\]{}:,.?]/.test(password)).toBe(true);
  });

  it("requires configured admin email in production", () => {
    setNodeEnv("production");

    expect(isAllowedAdminGenerator("admin@felbastore.local")).toBe(false);

    process.env.ADMIN_DEFAULT_EMAIL = "admin@felbastore.local";

    expect(isAllowedAdminGenerator("admin@felbastore.local")).toBe(true);
    expect(isAllowedAdminGenerator("other@felbastore.local")).toBe(false);
  });

  it("consumes one-time admin password exactly once", async () => {
    const password = "A9#d82!3kd@29fj";
    const hash = await bcrypt.hash(password, 10);

    const queryRawMock = prisma.$queryRaw as jest.Mock;
    queryRawMock
      .mockResolvedValueOnce([
        {
          id: "pwd_1",
          hashedPassword: hash,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "pwd_1",
          expiresAt: new Date(Date.now() + 60_000),
        },
      ])
      .mockResolvedValueOnce([]);

    const firstConsume = await consumeAdminPassword(password);
    const secondConsume = await consumeAdminPassword(password);

    expect(firstConsume?.id).toBe("pwd_1");
    expect(secondConsume).toBeNull();
  });
});
