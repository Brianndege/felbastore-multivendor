import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function VendorsPage() {
  // Mock vendor data - in a real app, this would come from your database
  const vendors = [
    {
      id: "1",
      name: "AudioTech",
      storeName: "AudioTech Store",
      description: "Premium audio equipment and accessories for audiophiles",
      logo: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&auto=format&fit=crop&q=60",
      banner: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=60",
      rating: 4.8,
      totalProducts: 45,
      totalSales: 1250,
      joinedDate: "2023-01-15",
      categories: ["Electronics", "Audio"],
      location: "New York, USA",
      verified: true,
    },
    {
      id: "2",
      name: "EcoWear",
      storeName: "EcoWear Sustainable Fashion",
      description: "Sustainable and eco-friendly fashion for conscious consumers",
      logo: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&auto=format&fit=crop&q=60",
      banner: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=60",
      rating: 4.6,
      totalProducts: 78,
      totalSales: 890,
      joinedDate: "2023-02-20",
      categories: ["Fashion", "Sustainable"],
      location: "California, USA",
      verified: true,
    },
    {
      id: "3",
      name: "NatureCare",
      storeName: "NatureCare Beauty",
      description: "Natural skincare and beauty products for healthy living",
      logo: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&auto=format&fit=crop&q=60",
      banner: "https://images.unsplash.com/photo-1556227834-09f1de7a7d14?w=800&auto=format&fit=crop&q=60",
      rating: 4.9,
      totalProducts: 32,
      totalSales: 567,
      joinedDate: "2023-03-10",
      categories: ["Beauty & Health", "Natural"],
      location: "Oregon, USA",
      verified: true,
    },
    {
      id: "4",
      name: "TechInnovate",
      storeName: "TechInnovate Solutions",
      description: "Cutting-edge smart home and IoT devices",
      logo: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=200&auto=format&fit=crop&q=60",
      banner: "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=800&auto=format&fit=crop&q=60",
      rating: 4.4,
      totalProducts: 28,
      totalSales: 445,
      joinedDate: "2023-04-05",
      categories: ["Electronics", "Smart Home"],
      location: "Texas, USA",
      verified: false,
    },
    {
      id: "5",
      name: "ArtisanCrafts",
      storeName: "Artisan Crafts & More",
      description: "Handcrafted items and unique artisan products",
      logo: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=200&auto=format&fit=crop&q=60",
      banner: "https://images.unsplash.com/photo-1595185584522-061e4a462262?w=800&auto=format&fit=crop&q=60",
      rating: 4.7,
      totalProducts: 156,
      totalSales: 2100,
      joinedDate: "2022-11-12",
      categories: ["Handmade", "Art & Collectibles"],
      location: "Vermont, USA",
      verified: true,
    },
    {
      id: "6",
      name: "EcoLiving",
      storeName: "EcoLiving Essentials",
      description: "Eco-friendly products for sustainable living",
      logo: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=200&auto=format&fit=crop&q=60",
      banner: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=60",
      rating: 4.5,
      totalProducts: 67,
      totalSales: 723,
      joinedDate: "2023-05-18",
      categories: ["Home & Garden", "Sustainable"],
      location: "Colorado, USA",
      verified: true,
    },
  ];

  const featuredVendors = vendors.filter(vendor => vendor.verified && vendor.rating >= 4.7);

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
          <Input placeholder="Search vendors..." className="pr-10" />
          <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">All Vendors</Button>
          <Button variant="outline" size="sm">Verified Only</Button>
          <Button variant="outline" size="sm">New Vendors</Button>
        </div>
      </div>

      {/* Featured Vendors */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 text-[#e16b22]">Featured Vendors</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featuredVendors.map((vendor) => (
            <Card key={`featured-${vendor.id}`} className="overflow-hidden">
              <div className="aspect-[16/9] w-full overflow-hidden">
                <img
                  src={vendor.banner}
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
                    <Link href={`/vendors/${vendor.id}`}>Visit Store</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* All Vendors */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-[#e16b22]">All Vendors</h2>
        <div className="grid gap-4">
          {vendors.map((vendor) => (
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
                      <Link href={`/vendors/${vendor.id}`}>Visit Store</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
