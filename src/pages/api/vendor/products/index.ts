import { prisma } from "@/lib/prisma";
import { getSession } from "next-auth/react";
import formidable from "formidable";
import fs from "fs";
import sharp from "sharp"; // For image resizing/cropping

export const config = {
  api: {
    bodyParser: false, // Important for file uploads
  },
};

export default async function handler(req, res) {
  const session = await getSession({ req });

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
    // Handle new product creation
    const form = formidable({ multiples: true });

    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(500).json({ message: "Form parsing error", error: err });

      try {
        const { name, description, price, comparePrice, category, subcategory, tags, inventory, sku, currency } = fields;

        // Handle images
        let images: string[] = [];
        if (files.images) {
          const uploadedFiles = Array.isArray(files.images) ? files.images : [files.images];

          for (const file of uploadedFiles) {
            // Resize/crop using sharp
            const buffer = await sharp(file.filepath)
              .resize(800, 800, { fit: "cover" })
              .toBuffer();

            const uploadPath = `public/uploads/${file.originalFilename}`;
            fs.writeFileSync(uploadPath, buffer);
            images.push(`/uploads/${file.originalFilename}`);
          }
        }

        const product = await prisma.product.create({
          data: {
            name: String(name),
            description: String(description),
            price: parseFloat(price as string),
            comparePrice: parseFloat(comparePrice as string) || null,
            category: String(category),
            subcategory: String(subcategory) || null,
            tags: tags ? (tags as string).split(",").map((t) => t.trim()) : [],
            inventory: parseInt(inventory as string, 10) || 0,
            sku: String(sku) || null,
            currency: String(currency) || "USD",
            images,
            vendorId,
            status: "Active",
          },
        });

        return res.status(201).json(product);
      } catch (error) {
        console.error("[Vendor Product POST]", error);
        return res.status(500).json({ message: "Error creating product", error });
      }
    });
  }
}
