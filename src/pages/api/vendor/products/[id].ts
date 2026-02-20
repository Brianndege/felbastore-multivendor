import { prisma } from "@/lib/prisma";
import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  const session = await getSession({ req });

  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const vendorId = session.user.id;
  const { id } = req.query;

  if (req.method === "GET") {
    const product = await prisma.product.findUnique({ where: { id: String(id) } });
    if (!product || product.vendorId !== vendorId) return res.status(404).json({ message: "Product not found" });
    return res.status(200).json(product);
  }

  if (req.method === "PUT") {
    const body = req.body;
    const product = await prisma.product.findUnique({ where: { id: String(id) } });
    if (!product || product.vendorId !== vendorId) return res.status(404).json({ message: "Product not found" });

    const updated = await prisma.product.update({
      where: { id: String(id) },
      data: body,
    });

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    const product = await prisma.product.findUnique({ where: { id: String(id) } });
    if (!product || product.vendorId !== vendorId) return res.status(404).json({ message: "Product not found" });

    await prisma.product.delete({ where: { id: String(id) } });
    return res.status(200).json({ message: "Product deleted" });
  }
}
