import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { VISIBLE_VENDOR_PRODUCT_WHERE } from "@/lib/products/visibility";

export const dynamic = "force-dynamic";

export default async function NewArrivalsPage() {
  const products = await prisma.product.findMany({
    where: VISIBLE_VENDOR_PRODUCT_WHERE,
    select: {
      id: true,
      name: true,
      price: true,
      images: true,
      vendor: { select: { storeName: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 24,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-4 text-3xl font-bold text-[#e16b22]">New Arrivals</h1>
      <p className="mb-8 text-gray-600">Recently published products from approved vendors.</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <div className="aspect-video w-full bg-white">
              <img src={product.images[0] || "https://images.unsplash.com/photo-1557821552-17105176677c?w=500&auto=format&fit=crop&q=60"} alt={product.name} className="h-full w-full object-cover" />
            </div>
            <CardContent className="p-4">
              <h3 className="mb-1 font-semibold">{product.name}</h3>
              <p className="mb-2 text-xs text-gray-500">{product.vendor.storeName || product.vendor.name}</p>
              <span className="text-lg font-bold text-[#e16b22]">${Number(product.price).toFixed(2)}</span>
              <div className="mt-2 flex gap-2 text-xs">
                <Link href={`/products/${product.id}`} className="text-[#e16b22] underline">View Details</Link>
                <span className="ml-auto text-gray-500">New</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
