import { prisma } from "@/lib/prisma";
import { VISIBLE_VENDOR_PRODUCT_WHERE } from "@/lib/products/visibility";

export async function rebuildProductSearchIndex() {
  const products = await prisma.product.findMany({
    where: VISIBLE_VENDOR_PRODUCT_WHERE,
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      tags: true,
      sku: true,
    },
  });

  await prisma.$transaction([
    prisma.productSearchIndex.deleteMany({}),
    ...products.map((product) =>
      prisma.productSearchIndex.create({
        data: {
          productId: product.id,
          category: product.category,
          searchable: [product.name, product.description, product.category, product.sku || "", ...product.tags]
            .join(" ")
            .trim(),
        },
      })
    ),
  ]);

  return {
    indexedCount: products.length,
  };
}