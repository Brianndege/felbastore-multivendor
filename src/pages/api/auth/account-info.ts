import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../../api/auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "NO_SESSION" });
    }
    // Find Google account for this user
    const account = await prisma.account.findFirst({
      where: {
        user: { email: session.user.email },
        provider: "google",
      },
      select: {
        provider: true,
        providerAccountId: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });
    if (!account) {
      return res.status(404).json({ error: "NO_GOOGLE_ACCOUNT" });
    }
    res.status(200).json({
      email: account.user.email,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
    });
  } catch (err) {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
}
