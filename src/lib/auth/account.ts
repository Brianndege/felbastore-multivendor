import { prisma } from "@/lib/prisma";

export type AuthUserType = "user" | "vendor";

type BaseAccount = {
  id: string;
  email: string;
  name: string | null;
  password: string | null;
  role: string;
  mustChangePassword?: boolean;
  emailVerified: Date | null;
  sessionVersion: number;
};

export async function findAccountByEmail(userType: AuthUserType, email: string): Promise<BaseAccount | null> {
  if (userType === "user") {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        mustChangePassword: true,
        emailVerified: true,
        sessionVersion: true,
      },
    });
  }

  return prisma.vendor.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      role: true,
      emailVerified: true,
      sessionVersion: true,
    },
  });
}

export async function markEmailVerified(userType: AuthUserType, id: string) {
  if (userType === "user") {
    await prisma.user.update({
      where: { id },
      data: { emailVerified: new Date() },
    });
    return;
  }

  await prisma.vendor.update({
    where: { id },
    data: { emailVerified: new Date() },
  });
}

export async function updateAccountPassword(userType: AuthUserType, id: string, passwordHash: string) {
  if (userType === "user") {
    await prisma.user.update({
      where: { id },
      data: {
        password: passwordHash,
        sessionVersion: { increment: 1 },
      },
    });

    await prisma.session.deleteMany({ where: { userId: id } });
    return;
  }

  await prisma.vendor.update({
    where: { id },
    data: {
      password: passwordHash,
      sessionVersion: { increment: 1 },
    },
  });
}