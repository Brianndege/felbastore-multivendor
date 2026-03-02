import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { normalizeCategoryName } from "@/lib/categories";
import { getProductCreateModerationState } from "@/lib/product-workflow";

type BulkProductInput = {
  name?: string;
  description?: string;
  price?: number | string;
  comparePrice?: number | string;
  currency?: string;
  category?: string;
  subcategory?: string;
  tags?: string[] | string;
  inventory?: number | string;
  sku?: string;
  images?: string[];
  status?: string;
};

type BulkRowError = {
  row: number;
  field: string;
  errorCode: string;
  message: string;
};

type PreparedBulkProduct = {
  row: number;
  data: {
    vendorId: string;
    name: string;
    description: string;
    price: number;
    comparePrice: number | null;
    currency: string;
    category: string;
    subcategory: string | null;
    tags: string[];
    images: string[];
    inventory: number;
    sku: string | null;
    status: string;
    isApproved: boolean;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const vendorId = session.user.id;
  const moderationState = getProductCreateModerationState();
  const items = Array.isArray(req.body) ? (req.body as BulkProductInput[]) : [];

  if (items.length === 0) {
    return res.status(400).json({ message: "No products provided" });
  }

  const errors: BulkRowError[] = [];
  const seenSkus = new Set<string>();

  const preparedDraft = items
    .map((item, index) => {
      const row = index + 2;
      const name = String(item.name ?? "").trim();
      const description = String(item.description ?? "").trim();
      const category = normalizeCategoryName(String(item.category ?? ""));
      const price = Number(item.price ?? 0);
      const inventory = Number(item.inventory ?? 0);
      const currency = String(item.currency ?? "KES").trim().toUpperCase() || "KES";
      const status = String(item.status ?? "active").trim().toLowerCase();
      const comparePriceRaw =
        item.comparePrice !== undefined && item.comparePrice !== null && String(item.comparePrice) !== ""
          ? Number(item.comparePrice)
          : null;
      const sku = item.sku ? String(item.sku).trim() : null;

      let hasError = false;

      if (!name) {
        errors.push({ row, field: "name", errorCode: "REQUIRED_NAME", message: "Name is required" });
        hasError = true;
      }

      if (!description) {
        errors.push({ row, field: "description", errorCode: "REQUIRED_DESCRIPTION", message: "Description is required" });
        hasError = true;
      }

      if (!category) {
        errors.push({ row, field: "category", errorCode: "REQUIRED_CATEGORY", message: "Category is required" });
        hasError = true;
      }

      if (!Number.isFinite(price) || price <= 0) {
        errors.push({ row, field: "price", errorCode: "INVALID_PRICE", message: "Price must be a positive number" });
        hasError = true;
      }

      if (comparePriceRaw !== null && (!Number.isFinite(comparePriceRaw) || comparePriceRaw < 0)) {
        errors.push({ row, field: "comparePrice", errorCode: "INVALID_COMPARE_PRICE", message: "Compare price must be a valid non-negative number" });
        hasError = true;
      }

      if (!Number.isFinite(inventory) || inventory < 0) {
        errors.push({ row, field: "inventory", errorCode: "INVALID_INVENTORY", message: "Inventory must be a non-negative number" });
        hasError = true;
      }

      if (currency.length !== 3) {
        errors.push({ row, field: "currency", errorCode: "INVALID_CURRENCY", message: "Currency must be a 3-letter code (e.g., KES, USD)" });
        hasError = true;
      }

      if (!["active", "inactive", "low_stock"].includes(status)) {
        errors.push({ row, field: "status", errorCode: "INVALID_STATUS", message: "Status must be active, inactive, or low_stock" });
        hasError = true;
      }

      if (sku) {
        if (seenSkus.has(sku)) {
          errors.push({ row, field: "sku", errorCode: "DUPLICATE_SKU_IN_FILE", message: "Duplicate SKU found in upload file" });
          hasError = true;
        } else {
          seenSkus.add(sku);
        }
      }

      if (hasError) {
        return null;
      }

      return {
        row,
        data: {
          vendorId,
          name,
          description,
          price,
          comparePrice: comparePriceRaw,
          currency,
          category,
          subcategory: item.subcategory ? String(item.subcategory) : null,
          tags: Array.isArray(item.tags)
            ? item.tags.map((tag) => String(tag).trim()).filter(Boolean)
            : typeof item.tags === "string"
              ? item.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
              : [],
          images: Array.isArray(item.images) ? item.images : [],
          inventory: Math.max(0, Math.trunc(inventory)),
          sku,
          status: moderationState.status,
          isApproved: moderationState.isApproved,
        },
      };
    });

  const prepared: PreparedBulkProduct[] = preparedDraft.filter((product): product is PreparedBulkProduct => product !== null);

  const preparedSkus = prepared
    .map((product) => product.data.sku)
    .filter((sku): sku is string => Boolean(sku));

  if (preparedSkus.length > 0) {
    const existingSkuProducts = await prisma.product.findMany({
      where: {
        sku: {
          in: preparedSkus,
        },
      },
      select: { sku: true },
    });

    const existingSkuSet = new Set(existingSkuProducts.map((product) => product.sku).filter((sku): sku is string => Boolean(sku)));

    if (existingSkuSet.size > 0) {
      for (const product of prepared) {
        if (product.data.sku && existingSkuSet.has(product.data.sku)) {
          errors.push({ row: product.row, field: "sku", errorCode: "SKU_ALREADY_EXISTS", message: "SKU already exists in the system" });
        }
      }
    }
  }

  const errorRows = new Set(errors.map((error) => error.row));
  const validPrepared = prepared.filter((product) => !errorRows.has(product.row));

  if (validPrepared.length === 0) {
    return res.status(400).json({
      message: "No valid products found in payload",
      receivedCount: items.length,
      validCount: 0,
      invalidCount: errors.length > 0 ? new Set(errors.map((error) => error.row)).size : items.length,
      errors,
    });
  }

  const result = await prisma.product.createMany({
    data: validPrepared.map((product) => product.data),
    skipDuplicates: true,
  });

  const validCount = validPrepared.length;
  const invalidCount = errorRows.size;
  const skippedCount = Math.max(validCount - result.count, 0);

  return res.status(201).json({
    message: "Bulk upload completed",
    createdCount: result.count,
    validCount,
    invalidCount,
    skippedCount,
    receivedCount: items.length,
    errors,
  });
}
