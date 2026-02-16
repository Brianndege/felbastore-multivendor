import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  // Mock data for featured products
  const featuredProducts = [
    {
      id: "1",
      name: "Premium Bluetooth Headphones",
      price: 149.99,
      description: "Noise-cancelling headphones with crystal clear sound",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cHJvZHVjdHxlbnwwfHwwfHx8MA%3D%3D",
      vendor: "AudioTech",
    },
    {
      id: "2",
      name: "Handcrafted Wooden Watch",
      price: 89.99,
      description: "Elegant timepiece made from sustainable bamboo",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHByb2R1Y3R8ZW58MHx8MHx8fDA%3D",
      vendor: "EcoWear",
    },
    {
      id: "3",
      name: "Organic Face Moisturizer",
      price: 34.99,
      description: "Natural ingredients for smooth and healthy skin",
      image: "https://images.unsplash.com/photo-1556227834-09f1de7a7d14?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjB8fHByb2R1Y3R8ZW58MHx8MHx8fDA%3D",
      vendor: "NatureCare",
    },
    {
      id: "4",
      name: "Smart Home Controller",
      price: 129.99,
      description: "Control your entire home with simple voice commands",
      image: "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fHRlY2h8ZW58MHx8MHx8fDA%3D",
      vendor: "TechInnovate",
    },
  ];

  // Mock data for categories
  const categories = [
    { id: "1", name: "Electronics", icon: "📱" },
    { id: "2", name: "Fashion", icon: "👕" },
    { id: "3", name: "Home & Garden", icon: "🏡" },
    { id: "4", name: "Beauty & Health", icon: "💄" },
    { id: "5", name: "Toys & Games", icon: "🎮" },
    { id: "6", name: "Sports", icon: "⚽" },
  ];

  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-[#e16b22] to-[#ffb98a] py-20 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <h1 className="mb-4 text-4xl font-bold sm:text-5xl">
              Your One-Stop Multivendor Marketplace
            </h1>
            <p className="mb-8 text-lg opacity-90">
              Discover unique products from trusted vendors all in one place.
              Join thousands of happy customers shopping with confidence.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-white text-[#e16b22] hover:bg-orange-50">
                <Link href="/products">Shop Now</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
                <Link href="/vendors/register">Become a Vendor</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">Shop by Category</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.id}`}
                className="flex flex-col items-center justify-center rounded-lg bg-white p-6 text-center shadow-sm transition-all hover:shadow-md"
              >
                <span className="mb-2 text-4xl">{category.icon}</span>
                <span className="font-medium">{category.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">Featured Products</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden transition-all hover:shadow-lg">
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                </div>
                <CardHeader>
                  <CardTitle className="line-clamp-1">{product.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    by {product.vendor}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-[#e16b22]">${product.price.toFixed(2)}</p>
                  <p className="mt-2 text-sm line-clamp-2">{product.description}</p>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={`/products/${product.id}`}>View Product</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="outline" size="lg">
              <Link href="/products">View All Products</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Vendor Highlight */}
      <section className="bg-violet-50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="mb-4 text-3xl font-bold">Start Selling Your Products Today</h2>
              <p className="mb-6 text-lg">
                Join our growing community of vendors and reach thousands of customers.
                Low fees, powerful tools, and dedicated support to help your business thrive.
              </p>
              <Button asChild size="lg">
                <Link href="/vendors/register">Become a Vendor</Link>
              </Button>
            </div>
            <div className="order-first md:order-last">
              <img
                src="https://images.unsplash.com/photo-1556742031-c6961e8560b0?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8b25saW5lJTIwc2VsbGVyfGVufDB8fDB8fHww"
                alt="Vendor selling products"
                className="rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">What Our Customers Say</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-white">
                <CardContent className="pt-6">
                  <div className="mb-4 flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className="text-yellow-400">★</span>
                    ))}
                  </div>
                  <p className="mb-4 italic">
                    "This marketplace has been a game-changer! Quality products from unique vendors that I wouldn't find elsewhere."
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-violet-200 flex items-center justify-center text-violet-700 font-bold">
                      {String.fromCharCode(64 + i)}
                    </div>
                    <div>
                      <p className="font-medium">Happy Customer {i}</p>
                      <p className="text-sm text-gray-500">Verified Buyer</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
