import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getAffiliateProduct(id: string) {
  return prisma.affiliateProduct.findUnique({
    where: { id },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getAffiliateProduct(id);

  if (!product || !product.isActive) {
    return {
      title: "Affiliate Product Not Found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${product.title} | Partner Product`,
    description: product.description,
    alternates: {
      canonical: `/affiliate/${product.id}`,
    },
    openGraph: {
      title: product.title,
      description: product.description,
      images: [{ url: product.imageUrl, alt: product.title }],
    },
  };
}

export default async function AffiliateProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getAffiliateProduct(id);

  if (!product || !product.isActive) {
    notFound();
  }

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: [product.imageUrl],
    category: product.category,
    offers: {
      "@type": "Offer",
      price: Number(product.price),
      priceCurrency: product.currency,
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "External Store",
      },
    },
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Affiliate disclosure: This product is sold by an external partner store. We may earn a commission if you purchase.
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="aspect-square w-full overflow-hidden bg-muted">
            <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover" />
          </div>

          <CardContent className="space-y-4 p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sold by Partner · External Store</p>
            <CardHeader className="p-0">
              <CardTitle className="text-2xl">{product.title}</CardTitle>
            </CardHeader>
            <p className="text-sm text-muted-foreground">{product.description}</p>
            <p className="text-2xl font-bold">{product.currency} {Number(product.price).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Affiliate network: {product.affiliateNetwork}</p>

            <div className="mobile-stack flex flex-wrap gap-2">
              <Button asChild className="touch-target">
                <Link href={`/api/affiliate/outbound/${product.id}`} rel="sponsored nofollow noopener" target="_blank">
                  View on External Store
                </Link>
              </Button>
              <Button asChild variant="outline" className="touch-target">
                <Link href="/products">Back to Products</Link>
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema),
        }}
      />
    </div>
  );
}