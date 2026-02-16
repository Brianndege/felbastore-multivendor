import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

// Mock categories data
const CATEGORIES = {
  "electronics": {
    id: "electronics",
    name: "Electronics",
    icon: "📱",
    description: "Smartphones, laptops, headphones, and tech gadgets",
    image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1200&auto=format&fit=crop&q=60"
  },
  "fashion": {
    id: "fashion",
    name: "Fashion",
    icon: "👕",
    description: "Clothing, shoes, accessories, and style essentials",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=60"
  },
  "home-garden": {
    id: "home-garden",
    name: "Home & Garden",
    icon: "🏡",
    description: "Furniture, decor, gardening tools, and home essentials",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&auto=format&fit=crop&q=60"
  },
  "beauty-health": {
    id: "beauty-health",
    name: "Beauty & Health",
    icon: "💄",
    description: "Skincare, makeup, wellness, and health products",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&auto=format&fit=crop&q=60"
  }
};

// Mock products for each category
const CATEGORY_PRODUCTS = {
  "electronics": [
    {
      id: "1",
      name: "Premium Bluetooth Headphones",
      price: 149.99,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60",
      vendor: "AudioTech",
      rating: 4.7,
    },
    {
      id: "4",
      name: "Smart Home Controller",
      price: 129.99,
      image: "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=500&auto=format&fit=crop&q=60",
      vendor: "TechInnovate",
      rating: 4.2,
    },
    {
      id: "7",
      name: "Portable Bluetooth Speaker",
      price: 79.99,
      image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&auto=format&fit=crop&q=60",
      vendor: "AudioTech",
      rating: 4.5,
    }
  ],
  "fashion": [
    {
      id: "2",
      name: "Handcrafted Wooden Watch",
      price: 89.99,
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60",
      vendor: "EcoWear",
      rating: 4.4,
    }
  ],
  "home-garden": [
    {
      id: "5",
      name: "Stainless Steel Water Bottle",
      price: 24.99,
      image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60",
      vendor: "EcoLiving",
      rating: 4.6,
    },
    {
      id: "6",
      name: "Handmade Ceramic Mug Set",
      price: 39.99,
      image: "https://images.unsplash.com/photo-1595185584522-061e4a462262?w=500&auto=format&fit=crop&q=60",
      vendor: "ArtisanCrafts",
      rating: 4.8,
    }
  ],
  "beauty-health": [
    {
      id: "3",
      name: "Organic Face Moisturizer",
      price: 34.99,
      image: "https://images.unsplash.com/photo-1556227834-09f1de7a7d14?w=500&auto=format&fit=crop&q=60",
      vendor: "NatureCare",
      rating: 4.9,
    }
  ]
};

// Generate static params for build
export function generateStaticParams() {
  return Object.keys(CATEGORIES).map((id) => ({
    id: id,
  }));
}

export default function CategoryPage({ params }: { params: { id: string } }) {
  const category = CATEGORIES[params.id as keyof typeof CATEGORIES];
  const products = CATEGORY_PRODUCTS[params.id as keyof typeof CATEGORY_PRODUCTS] || [];

  if (!category) {
    notFound();
  }

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
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Price: Low to High</Button>
          <Button variant="outline" size="sm">Most Popular</Button>
          <Button variant="outline" size="sm">Newest</Button>
        </div>
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
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center text-xs text-yellow-400">
                    <span>{product.rating}</span>
                    <span className="ml-1">★</span>
                  </div>
                </div>
                <h3 className="mb-1 line-clamp-1 font-medium">{product.name}</h3>
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
          {Object.values(CATEGORIES)
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
