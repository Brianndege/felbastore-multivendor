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

        // Handle images
        let images: string[] = [];
        if (files.images) {
          fs.mkdirSync("public/uploads", { recursive: true });
          const uploadedFiles = Array.isArray(files.images) ? files.images : [files.images];

          for (const file of uploadedFiles) {
            const safeName = file.originalFilename || `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
            const uploadPath = `public/uploads/${safeName}`;
            fs.copyFileSync(file.filepath, uploadPath);
            images.push(`/uploads/${safeName}`);
          }
        }

        const moderationState = getProductCreateModerationState();

        const product = await prisma.product.create({
          data: {
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
            status: moderationState.status,
            isApproved: moderationState.isApproved,
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
        return res.status(500).json({ message: "Error creating product", error });
      }
    });

    return;
  }

  return res.status(405).json({ message: "Method not allowed" });
}
