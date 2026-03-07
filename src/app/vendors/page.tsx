"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type PublicVendor = {
  id: string;
  name: string;
  storeName: string;
  description: string;
  logo: string;
  rating: number;
  totalProducts: number;
  totalSales: number;
  joinedDate: string;
  isNew?: boolean;
  categories: string[];
  location: string;
  verified: boolean;
};

export default function VendorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "verified" | "new">("all");
  const [vendors, setVendors] = useState<PublicVendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const debouncedSearch = useDebouncedValue(searchQuery, 350);

  useEffect(() => {
    let active = true;

    const loadVendors = async () => {
      setLoadingVendors(true);
      try {
        const response = await fetch("/api/vendors/public");
        const payload = (await response.json()) as { vendors?: PublicVendor[] };
        if (!active) return;

        setVendors(Array.isArray(payload.vendors) ? payload.vendors : []);
      } catch (error) {
        console.error("Failed to load public vendors:", error);
        if (!active) return;
        setVendors([]);
      } finally {
        if (active) setLoadingVendors(false);
      }
    };

    void loadVendors();

    return () => {
      active = false;
    };
  }, []);

  const featuredVendors = vendors.filter((vendor) => vendor.verified && vendor.rating >= 4.7);
  const normalizedQuery = debouncedSearch.trim().toLowerCase();
  const isSearching = searchQuery !== debouncedSearch;

  const filteredVendors = useMemo(() => {
    const filteredByMode = vendors.filter((vendor) => {
      if (filterMode === "verified") return vendor.verified;
      if (filterMode === "new") {
        if (vendor.isNew) return true;
        const joined = new Date(vendor.joinedDate).getTime();
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        return joined >= ninetyDaysAgo;
      }
      return true;
    });

    if (!normalizedQuery) {
      return filteredByMode;
    }

    return filteredByMode.filter((vendor) =>
      [vendor.storeName, vendor.name, vendor.description, vendor.location, ...vendor.categories]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [vendors, filterMode, normalizedQuery]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#e16b22]">Our Vendors</h1>
        <p className="text-gray-500">
          Discover amazing products from our trusted vendor community
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search vendors..."
            className="pr-16"
            aria-label="Search vendors"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              className="absolute right-8 top-2.5 text-xs text-muted-foreground"
              aria-label="Clear vendor search"
              onClick={() => setSearchQuery("")}
            >
              ✕
            </button>
          )}
          <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
          {isSearching && <p className="mt-1 text-xs text-muted-foreground">Searching...</p>}
        </div>
        <div className="mobile-stack flex gap-2">
          <Button variant={filterMode === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterMode("all")}>All Vendors</Button>
          <Button variant={filterMode === "verified" ? "default" : "outline"} size="sm" onClick={() => setFilterMode("verified")}>Verified Only</Button>
          <Button variant={filterMode === "new" ? "default" : "outline"} size="sm" onClick={() => setFilterMode("new")}>New Vendors</Button>
        </div>
      </div>

      {/* Featured Vendors */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 text-[#e16b22]">Featured Vendors</h2>
        {loadingVendors ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Loading vendors...</div>
        ) : featuredVendors.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No featured vendors available yet.</div>
        ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featuredVendors.map((vendor) => (
            <Card key={`featured-${vendor.id}`} className="overflow-hidden">
              <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                <img
                  src={vendor.logo || "/placeholder-product.jpg"}
                  alt={vendor.storeName}
                  className="h-full w-full object-cover"
                />
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                    <img
                      src={vendor.logo}
                      alt={vendor.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{vendor.storeName}</CardTitle>
                      {vendor.verified && (
                        <Badge variant="secondary" className="text-xs">
                          ✓ Verified
                        </Badge>
                      )}
                      {vendor.isNew && (
                        <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">
                          New
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center text-sm text-yellow-400">
                      <span>{vendor.rating}</span>
                      <span className="ml-1">★</span>
                      <span className="ml-2 text-gray-500">
                        ({vendor.totalSales} sales)
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {vendor.description}
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {vendor.categories.map((category) => (
                    <Badge key={category} variant="outline" className="text-xs">
                      {category}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {vendor.totalProducts} products
                  </span>
                  <Button asChild size="sm">
                    <Link href={`/products?q=${encodeURIComponent(vendor.storeName)}`}>Visit Store</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        )}
      </div>

      {/* All Vendors */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-[#e16b22]">All Vendors</h2>
        {loadingVendors ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Loading vendors...</div>
        ) : filteredVendors.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        ) : (
        <div className="grid gap-4">
          {filteredVendors.map((vendor) => (
            <Card key={vendor.id}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100">
                      <img
                        src={vendor.logo}
                        alt={vendor.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold">{vendor.storeName}</h3>
                        {vendor.verified && (
                          <Badge variant="secondary" className="text-xs">
                            ✓ Verified
                          </Badge>
                        )}
                        {vendor.isNew && (
                          <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">
                            New
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center text-sm text-yellow-400 mb-1">
                        <span>{vendor.rating}</span>
                        <span className="ml-1">★</span>
                        <span className="ml-2 text-gray-500">
                          {vendor.totalSales} sales
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{vendor.location}</p>
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {vendor.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {vendor.categories.map((category) => (
                        <Badge key={category} variant="outline" className="text-xs">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <div className="text-sm text-gray-500">
                      {vendor.totalProducts} products
                    </div>
                    <div className="text-xs text-gray-400">
                      Joined {new Date(vendor.joinedDate).toLocaleDateString()}
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/products?q=${encodeURIComponent(vendor.storeName)}`}>Visit Store</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="mt-16 rounded-lg bg-[#e16b22]/10 p-8 text-center">
        <h2 className="text-2xl font-bold mb-2 text-[#e16b22]">Want to become a vendor?</h2>
        <p className="text-gray-600 mb-6">
          Join our marketplace and start selling your products to thousands of customers
        </p>
        <Button asChild size="lg" className="bg-[#e16b22] hover:bg-[#cf610d] text-white">
          <Link href="/vendors/register">Become a Vendor</Link>
        </Button>
      </div>
    </div>
  );
}
