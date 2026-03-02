import type { PaymentMethodKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type EligibilityItem = {
  productId: string;
  quantity: number;
};

export type EligibilityAddress = {
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
};

export type VendorCoverageResult = {
  vendorId: string;
  vendorName?: string;
  vendorStoreName?: string;
  eligible: boolean;
  reason?: string;
  zoneId?: string;
  distanceKm?: number;
};

export type EligibilityPaymentOption = {
  code: PaymentMethodKind;
  label: string;
  requiresApproval: boolean;
};

export class CheckoutValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CheckoutValidationError";
    this.code = code;
    this.details = details;
  }
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase();
}

export async function evaluateCheckoutEligibility(params: {
  userId: string;
  address: EligibilityAddress;
  items?: EligibilityItem[];
}) {
  const requestItems = Array.isArray(params.items) ? params.items : [];

  const items = requestItems.length
    ? requestItems
    : (
        await prisma.cartItem.findMany({
          where: { userId: params.userId },
          select: { productId: true, quantity: true },
        })
      ).map((item) => ({ productId: item.productId, quantity: item.quantity }));

  if (!items.length) {
    throw new CheckoutValidationError("Cart is empty", "CART_EMPTY");
  }

  const quantityByProductId = new Map(items.map((item) => [item.productId, Number(item.quantity) || 0]));
  const uniqueProductIds = [...new Set(items.map((item) => item.productId))];

  const products = await prisma.product.findMany({
    where: {
      id: { in: uniqueProductIds },
      status: "active",
      isApproved: true,
    },
    include: {
      vendor: {
        include: {
          deliveryZones: {
            where: { isActive: true },
          },
        },
      },
      paymentMethods: {
        include: {
          vendorPaymentMethod: true,
        },
      },
    },
  });

  if (products.length !== uniqueProductIds.length) {
    throw new CheckoutValidationError(
      "Some items are unavailable or not approved",
      "PRODUCT_UNAVAILABLE"
    );
  }

  for (const product of products) {
    const requestedQuantity = quantityByProductId.get(product.id) || 0;
    if (requestedQuantity < 1 || requestedQuantity > product.inventory) {
      throw new CheckoutValidationError(
        `Insufficient stock for ${product.name}`,
        "INSUFFICIENT_STOCK",
        {
          productId: product.id,
          available: product.inventory,
          requested: requestedQuantity,
        }
      );
    }
  }

  const normalizedAddressCity = normalizeText(params.address.city);
  const normalizedAddressCountry = normalizeText(params.address.country);
  const hasAddressCoordinates = Number.isFinite(params.address.lat) && Number.isFinite(params.address.lng);

  const vendorCoverageMap = new Map<
    string,
    {
      vendorName?: string;
      vendorStoreName?: string;
      eligible: boolean;
      reason?: string;
      zoneId?: string;
      distanceKm?: number;
    }
  >();

  for (const product of products) {
    const vendorId = product.vendorId;
    if (vendorCoverageMap.has(vendorId)) continue;

    const activeZones = product.vendor.deliveryZones || [];
    let eligible = false;
    let selectedZoneId: string | undefined;
    let selectedDistanceKm: number | undefined;
    let reason = "OUT_OF_RANGE";

    if (activeZones.length && hasAddressCoordinates) {
      for (const zone of activeZones) {
        if (
          zone.mode === "radius" &&
          zone.centerLat !== null &&
          zone.centerLng !== null &&
          zone.radiusKm !== null
        ) {
          const computedDistanceKm = distanceKm(
            Number(params.address.lat),
            Number(params.address.lng),
            Number(zone.centerLat),
            Number(zone.centerLng)
          );

          if (computedDistanceKm <= Number(zone.radiusKm)) {
            eligible = true;
            selectedZoneId = zone.id;
            selectedDistanceKm = Number(computedDistanceKm.toFixed(2));
            reason = "IN_RANGE";
            break;
          }
        }
      }
    } else {
      const vendorCity = normalizeText(product.vendor.city || "");
      const vendorCountry = normalizeText(product.vendor.country || "");
      if (vendorCity && vendorCountry && normalizedAddressCity && normalizedAddressCountry) {
        eligible = vendorCity === normalizedAddressCity && vendorCountry === normalizedAddressCountry;
        reason = eligible ? "CITY_COUNTRY_MATCH" : "CITY_COUNTRY_MISMATCH";
      } else if (!activeZones.length) {
        reason = "NO_ACTIVE_ZONE";
      } else {
        reason = "MISSING_COORDINATES";
      }
    }

    vendorCoverageMap.set(vendorId, {
      vendorName: product.vendor.name,
      vendorStoreName: product.vendor.storeName,
      eligible,
      reason,
      zoneId: selectedZoneId,
      distanceKm: selectedDistanceKm,
    });
  }

  const vendorCoverage: VendorCoverageResult[] = [...vendorCoverageMap.entries()].map(([vendorId, result]) => ({
    vendorId,
    ...result,
  }));

  const overallEligible = vendorCoverage.every((result) => result.eligible);

  const productMethodSets = products.map((product) => {
    const approvedMethods = product.paymentMethods
      .filter((item) => item.vendorPaymentMethod.approvalStatus === "approved" && item.vendorPaymentMethod.isActive)
      .map((item) => item.vendorPaymentMethod.methodKind as PaymentMethodKind);

    return new Set<PaymentMethodKind>(["PAY_ON_DELIVERY", ...approvedMethods]);
  });

  let intersection = productMethodSets[0] || new Set<PaymentMethodKind>(["PAY_ON_DELIVERY"]);
  for (const methodSet of productMethodSets.slice(1)) {
    intersection = new Set([...intersection].filter((method) => methodSet.has(method)));
  }

  const methodLabelMap = new Map<PaymentMethodKind, string>([["PAY_ON_DELIVERY", "Pay on Delivery"]]);
  for (const product of products) {
    for (const item of product.paymentMethods) {
      if (item.vendorPaymentMethod.approvalStatus === "approved" && item.vendorPaymentMethod.isActive) {
        methodLabelMap.set(item.vendorPaymentMethod.methodKind as PaymentMethodKind, item.vendorPaymentMethod.label);
      }
    }
  }

  const paymentOptions: EligibilityPaymentOption[] = [...intersection].map((methodKind) => ({
    code: methodKind,
    label: methodLabelMap.get(methodKind) || methodKind,
    requiresApproval: methodKind !== "PAY_ON_DELIVERY",
  }));

  return {
    eligible: overallEligible,
    vendorCoverage,
    paymentOptions,
    checkedItems: items,
  };
}
