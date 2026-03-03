import { notFound } from "next/navigation";
import type { Metadata } from "next";
import dynamicImport from "next/dynamic";
import { prisma } from "@/lib/prisma";
import { withVisibleVendorProductFilters } from "@/lib/products/visibility";

const ProductPageClient = dynamicImport(() => import("@/components/products/ProductPageClient"));

export const dynamic = "force-dynamic";

type Params = { id: string };

async function getProductById(id: string) {
  return prisma.product.findFirst({
    where: withVisibleVendorProductFilters({ id }),
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      category: true,
      images: true,
      avgRating: true,
      vendor: {
        select: {
          storeName: true,
          name: true,
        },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return {
      title: "Product Not Found",
      description: "The requested product could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const image = product.images?.[0] || "https://images.unsplash.com/photo-1557821552-17105176677c?w=500&auto=format&fit=crop&q=60";

  return {
    title: product.name,
    description: product.description,
    alternates: {
      canonical: `/products/${product.id}`,
    },
    openGraph: {
      title: product.name,
      description: product.description,
      type: "website",
      url: `/products/${product.id}`,
      images: [{ url: image, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: product.description,
      images: [image],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const relatedRaw = await prisma.product.findMany({
    where: withVisibleVendorProductFilters({
      category: product.category,
      id: { not: product.id },
    }),
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      category: true,
      images: true,
      avgRating: true,
      vendor: {
        select: {
          storeName: true,
          name: true,
        },
      },
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 4,
  });

  const mappedProduct = {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    description: product.description,
    image: product.images?.[0] || "https://images.unsplash.com/photo-1557821552-17105176677c?w=500&auto=format&fit=crop&q=60",
    vendor: product.vendor.storeName || product.vendor.name,
    rating: product.avgRating ? Number(product.avgRating) : 0,
    category: product.category,
  };

  const relatedProducts = relatedRaw.map((item) => ({
    id: item.id,
    name: item.name,
    price: Number(item.price),
    description: item.description,
    image: item.images?.[0] || "https://images.unsplash.com/photo-1557821552-17105176677c?w=500&auto=format&fit=crop&q=60",
    vendor: item.vendor.storeName || item.vendor.name,
    rating: item.avgRating ? Number(item.avgRating) : 0,
    category: item.category,
  }));

  return <ProductPageClient product={mappedProduct} relatedProducts={relatedProducts} />;
}
