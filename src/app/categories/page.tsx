import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES, getCategoryMetaBySlug, humanizeCategorySlug, toCategorySlug } from "@/lib/categories";
import { VISIBLE_VENDOR_PRODUCT_WHERE } from "@/lib/products/visibility";

export default async function CategoriesPage() {
  let products: Array<{ category: string | null }> = [];

  try {
    products = await prisma.product.findMany({
      where: VISIBLE_VENDOR_PRODUCT_WHERE,
      select: { category: true },
    });
  } catch {
    products = [];
  }

  const counts = new Map<string, number>();
  const categoryNames = new Map<string, string>();

  for (const product of products) {
    const categoryName = product.category?.trim();
    if (!categoryName) {
      continue;
    }

    const slug = toCategorySlug(categoryName);
    if (!slug) {
      continue;
    }

    counts.set(slug, (counts.get(slug) ?? 0) + 1);
    categoryNames.set(slug, categoryName);
  }

  const categories = DEFAULT_CATEGORIES
    .map((category) => ({
      ...category,
      productCount: counts.get(category.id) ?? 0,
    }))
    .concat(
      Array.from(counts.entries())
        .filter(([slug]) => !getCategoryMetaBySlug(slug))
        .map(([slug, productCount]) => ({
          id: slug,
          name: humanizeCategorySlug(slug),
          icon: "📦",
          description: `Products listed under ${categoryNames.get(slug) ?? humanizeCategorySlug(slug)}`,
          productCount,
          image: "https://images.unsplash.com/photo-1557821552-17105176677c?w=500&auto=format&fit=crop&q=60",
        }))
    )
    .sort((a, b) => b.productCount - a.productCount);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#e16b22]">Shop by Category</h1>
        <p className="text-gray-500">
          Browse our wide selection of products organized by category
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.id}`}
            className="group"
          >
            <Card className="h-full overflow-hidden transition-all hover:shadow-lg group-hover:shadow-xl">
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={category.image}
                  alt={category.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-2xl">{category.icon}</span>
                  <h3 className="font-semibold">{category.name}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {category.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#e16b22] group-hover:text-[#e16b22]">
                    Browse →
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Featured Categories Section */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold mb-6 text-[#e16b22]">Popular Categories</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {categories.slice(0, 3).map((category) => (
            <Link
              key={`featured-${category.id}`}
              href={`/categories/${category.id}`}
              className="group relative overflow-hidden rounded-lg"
            >
              <div className="aspect-[16/9] w-full">
                <img
                  src={category.image}
                  alt={category.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 transition-opacity group-hover:bg-black/50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="text-4xl mb-2">{category.icon}</div>
                    <h3 className="text-xl font-bold">{category.name}</h3>
                    <p className="text-sm opacity-90">
                      {category.productCount} products available
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
