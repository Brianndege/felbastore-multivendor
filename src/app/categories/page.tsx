import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export default function CategoriesPage() {
  const categories = [
    {
      id: "electronics",
      name: "Electronics",
      icon: "📱",
      description: "Smartphones, laptops, headphones, and tech gadgets",
      productCount: 245,
      image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "fashion",
      name: "Fashion",
      icon: "👕",
      description: "Clothing, shoes, accessories, and style essentials",
      productCount: 189,
      image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "home-garden",
      name: "Home & Garden",
      icon: "🏡",
      description: "Furniture, decor, gardening tools, and home essentials",
      productCount: 156,
      image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "beauty-health",
      name: "Beauty & Health",
      icon: "💄",
      description: "Skincare, makeup, wellness, and health products",
      productCount: 134,
      image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "toys-games",
      name: "Toys & Games",
      icon: "🎮",
      description: "Kids toys, board games, and entertainment",
      productCount: 98,
      image: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "sports",
      name: "Sports",
      icon: "⚽",
      description: "Athletic gear, fitness equipment, and outdoor sports",
      productCount: 87,
      image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "food-beverage",
      name: "Food & Beverage",
      icon: "🍽️",
      description: "Gourmet foods, beverages, and culinary delights",
      productCount: 76,
      image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "art-collectibles",
      name: "Art & Collectibles",
      icon: "🎨",
      description: "Artwork, antiques, and unique collectible items",
      productCount: 54,
      image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "handmade",
      name: "Handmade",
      icon: "✋",
      description: "Unique handcrafted items and artisan products",
      productCount: 112,
      image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "books-media",
      name: "Books & Media",
      icon: "📚",
      description: "Books, e-books, music, and digital media",
      productCount: 203,
      image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "automotive",
      name: "Automotive",
      icon: "🚗",
      description: "Car accessories, tools, and automotive parts",
      productCount: 91,
      image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "pet-supplies",
      name: "Pet Supplies",
      icon: "🐕",
      description: "Pet food, toys, accessories, and care products",
      productCount: 68,
      image: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=500&auto=format&fit=crop&q=60"
    }
  ];

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
