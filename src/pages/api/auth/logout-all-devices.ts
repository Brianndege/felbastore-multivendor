import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id || !session.user.role) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (session.user.role === "vendor") {
    await prisma.vendor.update({
      where: { id: session.user.id },
      data: { sessionVersion: { increment: 1 } },
    });
    return res.status(200).json({ message: "Logged out from all devices." });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { sessionVersion: { increment: 1 } },
  });

  await prisma.session.deleteMany({ where: { userId: session.user.id } });

  return res.status(200).json({ message: "Logged out from all devices." });
}