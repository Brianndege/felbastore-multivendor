import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CATEGORIES,
  getCategoryMetaBySlug,
  humanizeCategorySlug,
  toCategorySlug,
} from "@/lib/categories";
import { VISIBLE_VENDOR_PRODUCT_WHERE } from "@/lib/products/visibility";

// Generate static params for build
export function generateStaticParams() {
  return DEFAULT_CATEGORIES.map((category) => ({
    id: category.id,
  }));
}

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let allProducts: any[] = [];

  try {
    allProducts = await prisma.product.findMany({
      where: VISIBLE_VENDOR_PRODUCT_WHERE,
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        images: true,
        category: true,
        vendor: {
          select: {
            storeName: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch {
    allProducts = [];
  }

  const products = allProducts
    .filter((product) => toCategorySlug(product.category) === id)
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      currency: product.currency || "KES",
      image: product.images?.[0] || "https://images.unsplash.com/photo-1557821552-17105176677c?w=500&auto=format&fit=crop&q=60",
      vendor: product.vendor.storeName || product.vendor.name,
    }));

  const knownCategory = getCategoryMetaBySlug(id);
  const category = knownCategory ?? {
    id,
    name: humanizeCategorySlug(id),
    icon: "📦",
    description: `Browse products in ${humanizeCategorySlug(id)}`,
    image: "https://images.unsplash.com/photo-1557821552-17105176677c?w=1200&auto=format&fit=crop&q=60",
  };

  if (!knownCategory && products.length === 0) {
    notFound();
  }

  const formatPrice = (price: number, currency: string) => {
    try {
      return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: currency || "KES",
      }).format(price);
    } catch {
      return `${currency || "KES"} ${price.toFixed(2)}`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <nav className="flex items-center space-x-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-violet-600">Home</Link>
          <span>›</span>
          <Link href="/categories" className="hover:text-violet-600">Categories</Link>
          <span>›</span>
          <span className="text-gray-900">{category.name}</span>
        </nav>
      </div>

      {/* Category Header */}
      <div className="mb-8 relative overflow-hidden rounded-lg">
        <div className="aspect-[16/6] w-full">
          <img
            src={category.image}
            alt={category.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="text-6xl mb-4">{category.icon}</div>
              <h1 className="text-4xl font-bold mb-2">{category.name}</h1>
              <p className="text-lg opacity-90 max-w-2xl">
                {category.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Sort Options */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {products.length} {products.length === 1 ? 'Product' : 'Products'} in {category.name}
          </h2>
        </div>
        <div className="flex gap-2" />
      </div>

      {/* Products Grid */}
      {products.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <div className="aspect-[4/3] w-full overflow-hidden">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="mb-1 line-clamp-1 font-medium">{product.name}</h3>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-violet-600">{formatPrice(product.price, product.currency)}</p>
                  <span className="text-xs text-gray-500">by {product.vendor}</span>
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <div className="flex w-full gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/products/${product.id}`}>View</Link>
                  </Button>
                  <Button size="sm" className="flex-1">
                    Add to Cart
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">{category.icon}</div>
          <h2 className="text-2xl font-semibold mb-2">No products yet</h2>
          <p className="text-gray-500 mb-6">
            We're working on adding more products to this category.
          </p>
          <Button asChild>
            <Link href="/categories">Browse Other Categories</Link>
          </Button>
        </div>
      )}

      {/* Related Categories */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold mb-6">Related Categories</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {DEFAULT_CATEGORIES
            .filter(cat => cat.id !== category.id)
            .slice(0, 4)
            .map((relatedCategory) => (
              <Link
                key={relatedCategory.id}
                href={`/categories/${relatedCategory.id}`}
                className="group rounded-lg border p-4 text-center transition-all hover:shadow-md"
              >
                <div className="text-3xl mb-2">{relatedCategory.icon}</div>
                <h3 className="font-medium group-hover:text-violet-600">
                  {relatedCategory.name}
                </h3>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
