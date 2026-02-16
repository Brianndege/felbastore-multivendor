import Link from "next/link";
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

export default function ProductsPage() {
  // Mock data for products
  const products = [
    {
      id: "1",
      name: "Premium Bluetooth Headphones",
      price: 149.99,
      description: "Noise-cancelling headphones with crystal clear sound",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cHJvZHVjdHxlbnwwfHwwfHx8MA%3D%3D",
      vendor: "AudioTech",
      rating: 4.7,
      category: "Electronics",
    },
    {
      id: "2",
      name: "Handcrafted Wooden Watch",
      price: 89.99,
      description: "Elegant timepiece made from sustainable bamboo",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHByb2R1Y3R8ZW58MHx8MHx8fDA%3D",
      vendor: "EcoWear",
      rating: 4.4,
      category: "Fashion",
    },
    {
      id: "3",
      name: "Organic Face Moisturizer",
      price: 34.99,
      description: "Natural ingredients for smooth and healthy skin",
      image: "https://images.unsplash.com/photo-1556227834-09f1de7a7d14?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjB8fHByb2R1Y3R8ZW58MHx8MHx8fDA%3D",
      vendor: "NatureCare",
      rating: 4.9,
      category: "Beauty & Health",
    },
    {
      id: "4",
      name: "Smart Home Controller",
      price: 129.99,
      description: "Control your entire home with simple voice commands",
      image: "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fHRlY2h8ZW58MHx8MHx8fDA%3D",
      vendor: "TechInnovate",
      rating: 4.2,
      category: "Electronics",
    },
    {
      id: "5",
      name: "Stainless Steel Water Bottle",
      price: 24.99,
      description: "Eco-friendly bottle that keeps drinks cold for 24 hours",
      image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fHdhdGVyJTIwYm90dGxlfGVufDB8fDB8fHww",
      vendor: "EcoLiving",
      rating: 4.6,
      category: "Home & Garden",
    },
    {
      id: "6",
      name: "Handmade Ceramic Mug Set",
      price: 39.99,
      description: "Set of 4 uniquely crafted ceramic mugs",
      image: "https://images.unsplash.com/photo-1595185584522-061e4a462262?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fG11Z3N8ZW58MHx8MHx8fDA%3D",
      vendor: "ArtisanCrafts",
      rating: 4.8,
      category: "Home & Garden",
    },
    {
      id: "7",
      name: "Portable Bluetooth Speaker",
      price: 79.99,
      description: "Waterproof speaker with 20-hour battery life",
      image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Ymx1ZXRvb3RoJTIwc3BlYWtlcnxlbnwwfHwwfHx8MA%3D%3D",
      vendor: "AudioTech",
      rating: 4.5,
      category: "Electronics",
    },
    {
      id: "8",
      name: "Organic Loose Leaf Tea Set",
      price: 29.99,
      description: "Collection of premium organic teas from around the world",
      image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8dGVhfGVufDB8fDB8fHww",
      vendor: "TeaHouse",
      rating: 4.7,
      category: "Food & Beverage",
    },
  ];

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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">All Products</h1>
        <p className="text-gray-500">Browse our wide selection of products from trusted vendors</p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Filters Sidebar */}
        <div className="md:w-1/4">
          <div className="sticky top-4 space-y-6 rounded-lg border bg-background p-4 shadow-sm">
            <div>
              <h3 className="mb-2 font-medium">Search</h3>
              <div className="relative">
                <Input placeholder="Search products..." className="pr-8" />
                <span className="absolute right-2 top-2.5">🔍</span>
              </div>
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
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">Showing {products.length} products</p>
            <div className="flex items-center gap-2">
              <span className="text-sm">Sort by:</span>
              <Select defaultValue="featured">
                <SelectTrigger className="w-[180px]">
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">{product.category}</span>
                    <div className="flex items-center text-xs text-yellow-400">
                      <span>{product.rating}</span>
                      <span className="ml-1">★</span>
                    </div>
                  </div>
                  <h3 className="mb-1 line-clamp-1 font-medium">{product.name}</h3>
                  <p className="mb-3 line-clamp-2 text-xs text-gray-500">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-violet-600">${product.price.toFixed(2)}</p>
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

          {/* Pagination */}
          <div className="mt-8 flex justify-center">
            <div className="flex space-x-1">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              {[1, 2, 3, 4, 5].map((page) => (
                <Button
                  key={page}
                  variant={page === 1 ? "default" : "outline"}
                  size="sm"
                  className="w-9"
                >
                  {page}
                </Button>
              ))}
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
