import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { normalizeCategoryName } from "@/lib/categories";
import { getProductCreateModerationState } from "@/lib/product-workflow";
import { logVendorProductActivity } from "@/lib/product-activity";
import { DATABASE_CONFIGURATION_ERROR, hasValidDatabaseUrl, mapDatabaseError } from "@/lib/database-guard";
import { normalizeVendorWorkflowStatus, validateVendorProductInput } from "@/lib/products/validation";
import { getVendorOnboardingChecklist } from "@/lib/vendor/onboarding";

export const config = {
  api: {
    bodyParser: false, // Important for file uploads
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "vendor") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const vendorId = session.user.id;

  if (!hasValidDatabaseUrl()) {
    return res.status(503).json({ message: DATABASE_CONFIGURATION_ERROR });
  }

  if (req.method === "GET") {
    // Fetch vendor products
    const products = await prisma.product.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(products);
  }

  if (req.method === "POST") {
    if (!enforceCsrfOrigin(req, res)) {
      return;
    }

    // Handle new product creation
    const form = formidable({ multiples: true });

    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(500).json({ message: "Form parsing error", error: err });

      try {
        const { name, description, price, comparePrice, category, subcategory, tags, inventory, sku, currency } = fields;
        const readField = (field: string | string[] | undefined) =>
          Array.isArray(field) ? field[0] : field;
        const readStringList = (field: string | string[] | undefined) =>
          (Array.isArray(field) ? field : field ? [field] : [])
            .map((value) => value.trim())
            .filter(Boolean);

        const nameValue = readField(name) || "";
        const descriptionValue = readField(description) || "";
        const priceValue = Number(readField(price) || 0);
        const comparePriceValue = Number(readField(comparePrice) || 0);
        const categoryValue = normalizeCategoryName(readField(category) || "");
        const subcategoryValue = readField(subcategory) || "";
        const tagsValue = readField(tags) || "";
        const inventoryValue = Number(readField(inventory) || 0);
        const skuValue = readField(sku) || "";
        const currencyValue = readField(currency) || "KES";
        const requestedWorkflowStatus = normalizeVendorWorkflowStatus(readField(fields.workflowStatus));

        // Handle images
        const images: string[] = readStringList(fields.existingImages);
        if (files.images) {
          const uploadedFiles = Array.isArray(files.images) ? files.images : [files.images];

          for (const file of uploadedFiles) {
            if (!file?.filepath) {
              continue;
            }

            const mimeType = file.mimetype || "image/jpeg";
            const fileBuffer = fs.readFileSync(file.filepath);
            images.push(`data:${mimeType};base64,${fileBuffer.toString("base64")}`);
          }
        }

        const validation = validateVendorProductInput({
          name: nameValue,
          description: descriptionValue,
          category: categoryValue,
          price: priceValue,
          imageCount: images.length,
          workflowStatus: requestedWorkflowStatus,
        });

        if (!validation.valid) {
          return res.status(400).json({ message: "Product validation failed", errors: validation.errors });
        }

        const moderationState = getProductCreateModerationState();
        const publishNow = requestedWorkflowStatus === "PENDING_APPROVAL";

        if (publishNow) {
          const onboarding = await getVendorOnboardingChecklist(vendorId);
          if (!onboarding?.isReadyForPublishing) {
            return res.status(400).json({
              message: "Vendor onboarding checklist is incomplete. Complete onboarding before publishing.",
              checklist: onboarding,
            });
          }
        }

        const workflowStatus = publishNow
          ? moderationState.isApproved
            ? "APPROVED"
            : "PENDING_APPROVAL"
          : "DRAFT";

        const status = publishNow ? moderationState.status : "inactive";
        const isApproved = publishNow ? moderationState.isApproved : false;

        const product = await prisma.product.create({
          data: {
            productType: "vendor",
            name: nameValue,
            description: descriptionValue,
            price: priceValue,
            comparePrice: comparePriceValue || null,
            category: categoryValue,
            subcategory: subcategoryValue || null,
            tags: tagsValue ? tagsValue.split(",").map((t) => t.trim()) : [],
            inventory: Number.isFinite(inventoryValue) ? inventoryValue : 0,
            sku: skuValue || null,
            currency: currencyValue || "KES",
            images,
            vendorId,
            status,
            isApproved,
            workflowStatus,
            createdBy: "vendor_portal",
          },
        });

        await logVendorProductActivity({
          vendorId,
          productId: product.id,
          action: "product_created",
          metadata: {
            category: product.category,
            status: product.status,
            isApproved: product.isApproved,
          },
        });

        return res.status(201).json(product);
      } catch (error) {
        console.error("[Vendor Product POST]", error);
        const dbErrorMessage = mapDatabaseError(error);
        return res.status(500).json({
          message: dbErrorMessage || "Error creating product",
          error,
        });
      }
    });

    return;
  }

  return res.status(405).json({ message: "Method not allowed" });
}
