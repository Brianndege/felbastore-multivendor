import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { VISIBLE_VENDOR_PRODUCT_WHERE } from "@/lib/products/visibility";

export const dynamic = "force-dynamic";

export default async function Home() {
  const categories = DEFAULT_CATEGORIES.slice(0, 6);

  const featuredProducts = await prisma.product.findMany({
    where: VISIBLE_VENDOR_PRODUCT_WHERE,
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      images: true,
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

  return (
    <main className="flex min-h-screen flex-col">
      <section className="relative bg-gradient-to-r from-[#e16b22] to-[#ffb98a] py-20 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <h1 className="mb-4 text-4xl font-bold sm:text-5xl">Your One-Stop Multivendor Marketplace</h1>
            <p className="mb-8 text-lg opacity-90">Discover unique products from trusted vendors all in one place.</p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-white text-[#e16b22] hover:bg-orange-50"><Link href="/products">Shop Now</Link></Button>
              <Button asChild size="lg" className="rounded-md border border-orange-500 bg-orange-500 px-6 py-3 font-semibold text-white transition-all duration-200 hover:border-orange-500 hover:bg-white hover:text-orange-500"><Link href="/vendors/register">Become a Vendor</Link></Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">Shop by Category</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {categories.map((category) => (
              <Link key={category.id} href={`/categories/${category.id}`} className="flex flex-col items-center justify-center rounded-lg bg-white p-6 text-center shadow-sm transition-all hover:shadow-md">
                <span className="mb-2 text-4xl">{category.icon}</span>
                <span className="font-medium">{category.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">Featured Products</h2>
          {featuredProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No products are live yet.</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <Card key={product.id} className="overflow-hidden transition-all hover:shadow-lg">
                  <div className="aspect-video w-full overflow-hidden">
                    <img src={product.images[0] || "https://images.unsplash.com/photo-1557821552-17105176677c?w=500&auto=format&fit=crop&q=60"} alt={product.name} className="h-full w-full object-cover transition-transform hover:scale-105" />
                  </div>
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{product.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">by {product.vendor.storeName || product.vendor.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-[#e16b22]">${Number(product.price).toFixed(2)}</p>
                    <p className="mt-2 text-sm line-clamp-2">{product.description}</p>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full"><Link href={`/products/${product.id}`}>View Product</Link></Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
          <div className="mt-10 text-center">
            <Button asChild variant="outline" size="lg"><Link href="/products">View All Products</Link></Button>
          </div>
        </div>
      </section>
    </main>
  );
}
