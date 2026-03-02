import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { CheckoutValidationError, evaluateCheckoutEligibility } from "@/lib/checkout-eligibility";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "user") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body || {};
  try {
    const eligibility = await evaluateCheckoutEligibility({
      userId: session.user.id,
      address: body.address || {},
      items: Array.isArray(body.items) ? body.items : undefined,
    });

    return res.status(200).json(eligibility);
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return res.status(400).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
}
