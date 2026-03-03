import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { runDummyProductCleanup } from "@/lib/admin/dummy-product-cleanup";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { adminPassword, confirmPhrase, dryRun = true } = req.body || {};

  if (confirmPhrase !== "DELETE_DUMMY_PRODUCTS") {
    return res.status(400).json({ error: "Confirmation phrase invalid." });
  }

  if (!adminPassword || typeof adminPassword !== "string") {
    return res.status(400).json({ error: "Admin password confirmation is required." });
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
    },
  });

  if (!adminUser || adminUser.role !== "admin" || !adminUser.password) {
    return res.status(403).json({ error: "Admin account is not eligible for this action." });
  }

  const passwordMatches = await bcrypt.compare(adminPassword, adminUser.password);
  if (!passwordMatches) {
    return res.status(403).json({ error: "Invalid admin password." });
  }

  try {
    const result = await runDummyProductCleanup({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      dryRun: Boolean(dryRun),
    });

    return res.status(200).json({
      message: result.dryRun
        ? "Dry-run completed. No records deleted."
        : "Dummy products removed successfully.",
      ...result,
    });
  } catch (error) {
    console.error("[cleanup-dummy]", error);
    return res.status(500).json({ error: "Unable to run dummy cleanup." });
  }
}