import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";

type DeliveryZoneUpdatePayload = {
  name?: string;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  isActive?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const vendorId = session.user.id;
  const id = typeof req.query.id === "string" ? req.query.id : "";

  if (!id) {
    return res.status(400).json({ error: "Invalid delivery zone id" });
  }

  const existingZone = await prisma.vendorDeliveryZone.findFirst({
    where: { id, vendorId },
  });

  if (!existingZone) {
    return res.status(404).json({ error: "Delivery zone not found" });
  }

  if (req.method === "PUT") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }

    const body = (req.body || {}) as DeliveryZoneUpdatePayload;
    const name = typeof body.name === "string" ? body.name.trim() : existingZone.name;
    const centerLat = Number(body.centerLat ?? existingZone.centerLat);
    const centerLng = Number(body.centerLng ?? existingZone.centerLng);
    const radiusKm = Number(body.radiusKm ?? existingZone.radiusKm);
    const isActive = typeof body.isActive === "boolean" ? body.isActive : existingZone.isActive;

    if (!name) {
      return res.status(400).json({ error: "Zone name is required" });
    }

    if (!Number.isFinite(centerLat) || centerLat < -90 || centerLat > 90) {
      return res.status(400).json({ error: "Valid center latitude is required" });
    }

    if (!Number.isFinite(centerLng) || centerLng < -180 || centerLng > 180) {
      return res.status(400).json({ error: "Valid center longitude is required" });
    }

    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      return res.status(400).json({ error: "Radius must be greater than 0" });
    }

    const zone = await prisma.vendorDeliveryZone.update({
      where: { id },
      data: {
        name,
        centerLat,
        centerLng,
        radiusKm,
        isActive,
      },
    });

    return res.status(200).json({
      zone: {
        id: zone.id,
        name: zone.name,
        mode: zone.mode,
        centerLat: zone.centerLat === null ? null : Number(zone.centerLat),
        centerLng: zone.centerLng === null ? null : Number(zone.centerLng),
        radiusKm: zone.radiusKm === null ? null : Number(zone.radiusKm),
        isActive: zone.isActive,
        createdAt: zone.createdAt,
        updatedAt: zone.updatedAt,
      },
    });
  }

  if (req.method === "DELETE") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }

    await prisma.vendorDeliveryZone.delete({ where: { id } });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
