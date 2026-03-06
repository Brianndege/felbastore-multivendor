import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";

type DeliveryZonePayload = {
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

  if (req.method === "GET") {
    const zones = await prisma.vendorDeliveryZone.findMany({
      where: { vendorId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    return res.status(200).json({
      zones: zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        mode: zone.mode,
        centerLat: zone.centerLat === null ? null : Number(zone.centerLat),
        centerLng: zone.centerLng === null ? null : Number(zone.centerLng),
        radiusKm: zone.radiusKm === null ? null : Number(zone.radiusKm),
        isActive: zone.isActive,
        createdAt: zone.createdAt,
        updatedAt: zone.updatedAt,
      })),
    });
  }

  if (req.method === "POST") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }

    const body = (req.body || {}) as DeliveryZonePayload;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const centerLat = Number(body.centerLat);
    const centerLng = Number(body.centerLng);
    const radiusKm = Number(body.radiusKm);
    const isActive = body.isActive !== false;

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

    const zone = await prisma.vendorDeliveryZone.create({
      data: {
        vendorId,
        name,
        mode: "radius",
        centerLat,
        centerLng,
        radiusKm,
        isActive,
      },
    });

    return res.status(201).json({
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

  return res.status(405).json({ error: "Method not allowed" });
}
