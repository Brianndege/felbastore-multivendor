"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency } from "@/lib/currency";

type FeedProduct = {
  id: string;
  productType: "vendor" | "affiliate";
  isDummy?: boolean;
  name: string;
  description: string;
  image: string;
  price: number;
  currency: string;
  category: string;
  vendorLabel: string;
  rating?: number;
  affiliateNetwork?: string;
};

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [vendorCount, setVendorCount] = useState(0);
  const [usingAffiliateFallback, setUsingAffiliateFallback] = useState(false);
  const [featuredAffiliate, setFeaturedAffiliate] = useState<FeedProduct[]>([]);
  const [trendingAffiliate, setTrendingAffiliate] = useState<FeedProduct[]>([]);
  const [disclosure, setDisclosure] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const debouncedQuery = useDebouncedValue(searchQuery, 400);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("q") || "";
    setSearchQuery(query);
  }, []);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const response = await fetch("/api/products/feed?take=30");
        const data = await response.json();
        if (!active) return;

        const safeProducts = Array.isArray(data.products)
          ? data.products.filter((item: FeedProduct) => !item?.isDummy)
          : [];

        setProducts(safeProducts);
        setVendorCount(typeof data.vendorCount === "number" ? data.vendorCount : 0);
        setUsingAffiliateFallback(Boolean(data.usingAffiliateFallback));
        setFeaturedAffiliate(Array.isArray(data.featuredAffiliate) ? data.featuredAffiliate : []);
        setTrendingAffiliate(Array.isArray(data.trendingAffiliate) ? data.trendingAffiliate : []);
        setDisclosure(typeof data.disclosure === "string" ? data.disclosure : "");
      } catch {
        if (!active) return;
        setProducts([]);
        setVendorCount(0);
      } finally {
        if (active) setIsLoadingProducts(false);
      }
    };

    void loadProducts();
    return () => {
      active = false;
    };
  }, []);

  // Mock categories for the filter
  const categories = [
    "Electronics",
    "Fashion",
    "Home & Garden",
    "Beauty & Health",
    "Toys & Games",
    "Sports",
    "Food & Beverage",
  ];

  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const isSearching = searchQuery !== debouncedQuery;

  const filteredProducts = useMemo(() => {
    if (!normalizedQuery) return products;

    return products.filter((product) =>
      [product.name, product.description, product.vendorLabel, product.category, product.affiliateNetwork || ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [products, normalizedQuery]);

  return (
    <div className="container mx-auto px-4 py-4 md:py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">All Products</h1>
        <p className="text-gray-500">Browse our wide selection of products from trusted vendors</p>
        {disclosure && (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {disclosure}
          </p>
        )}
        {usingAffiliateFallback && (
          <p className="mt-2 text-xs text-muted-foreground">
            Vendor products are currently limited; partner products are shown as a fallback.
          </p>
        )}
      </div>

      {usingAffiliateFallback && featuredAffiliate.length > 0 && (
        <div className="mb-6 rounded-lg border bg-background p-4">
          <h2 className="mb-2 text-lg font-semibold">Featured Partner Products</h2>
          <p className="text-xs text-muted-foreground">Sold by Partner · External Store</p>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters Sidebar */}
        <div className="lg:w-1/4">
          <div className="space-y-6 rounded-lg border bg-background p-4 shadow-sm lg:sticky lg:top-20">
            <div>
              <h3 className="mb-2 font-medium">Search</h3>
              <div className="relative">
                <Input
                  placeholder="Search products..."
                  aria-label="Search products"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pr-16"
                />
                {searchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    className="absolute right-8 top-2 text-xs text-muted-foreground"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear product search"
                  >
                    ✕
                  </button>
                )}
                <span className="absolute right-2 top-2.5">🔍</span>
              </div>
              {isSearching && <p className="mt-1 text-xs text-muted-foreground">Searching...</p>}
            </div>

            <div>
              <h3 className="mb-2 font-medium">Categories</h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox id={`category-${category}`} />
                    <label
                      htmlFor={`category-${category}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {category}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-medium">Price Range</h3>
              <div className="space-y-4">
                <Slider defaultValue={[0, 500]} max={1000} step={10} />
                <div className="flex items-center justify-between">
                  <span className="text-sm">$0</span>
                  <span className="text-sm">$1000</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-medium">Rating</h3>
              <div className="space-y-2">
                {[4, 3, 2, 1].map((rating) => (
                  <div key={rating} className="flex items-center space-x-2">
                    <Checkbox id={`rating-${rating}`} />
                    <label
                      htmlFor={`rating-${rating}`}
                      className="flex items-center text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={i < rating ? "text-yellow-400" : "text-gray-300"}>
                          ★
                        </span>
                      ))}
                      <span className="ml-1">& Up</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-medium">Vendors</h3>
              <div className="space-y-2">
                {["AudioTech", "EcoWear", "NatureCare", "TechInnovate", "EcoLiving"].map((vendor) => (
                  <div key={vendor} className="flex items-center space-x-2">
                    <Checkbox id={`vendor-${vendor}`} />
                    <label
                      htmlFor={`vendor-${vendor}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {vendor}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full">Apply Filters</Button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1">
          {/* Sort Options */}
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">Showing {filteredProducts.length} products · Live vendor products: {vendorCount}</p>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <span className="text-sm">Sort by:</span>
              <Select defaultValue="featured">
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Products */}
          {isLoadingProducts ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              <p>No products available yet.</p>
              <div className="mt-3 mobile-stack flex flex-wrap justify-center gap-2">
                <Button asChild className="touch-target" size="sm"><Link href="/vendors/dashboard/products">Start adding products</Link></Button>
                <Button asChild className="touch-target" size="sm" variant="outline"><Link href="/vendors/register">Become a Vendor</Link></Button>
              </div>
            </div>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                </div>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">{product.category}</span>
                    {typeof product.rating === "number" ? (
                      <div className="flex items-center text-xs text-yellow-400">
                        <span>{product.rating}</span>
                        <span className="ml-1">★</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-700">Sold by Partner</span>
                    )}
                  </div>
                  <h3 className="mb-1 line-clamp-1 font-medium">{product.name}</h3>
                  <p className="mb-3 line-clamp-2 text-xs text-gray-500">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-violet-600">{formatCurrency(product.price, product.currency)}</p>
                    <span className="text-xs text-gray-500">by {product.vendorLabel}</span>
                  </div>
                  {product.productType === "affiliate" && (
                    <p className="mt-1 text-[10px] text-muted-foreground">External Store · {product.affiliateNetwork}</p>
                  )}
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <div className="mobile-stack flex w-full flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="touch-target flex-1">
                      <Link href={product.productType === "affiliate" ? `/affiliate/${product.id}` : `/products/${product.id}`}>View</Link>
                    </Button>
                    {product.productType === "vendor" ? (
                      <Button size="sm" className="touch-target flex-1">
                        Add to Cart
                      </Button>
                    ) : (
                      <Button asChild size="sm" className="touch-target flex-1">
                        <Link href={`/api/affiliate/outbound/${product.id}`} rel="sponsored nofollow noopener" target="_blank">
                          Visit Store
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
          )}

          {/* Pagination */}
          <div className="mt-8 flex justify-center">
            <div className="mobile-stack flex flex-wrap gap-1">
              <Button className="touch-target" variant="outline" size="sm" disabled>
                Previous
              </Button>
              {[1, 2, 3, 4, 5].map((page) => (
                <Button
                  key={page}
                  variant={page === 1 ? "default" : "outline"}
                  size="sm"
                  className="touch-target w-9"
                >
                  {page}
                </Button>
              ))}
              <Button className="touch-target" variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
