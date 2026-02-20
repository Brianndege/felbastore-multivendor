import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
  });
}
