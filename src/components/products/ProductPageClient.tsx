"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCart } from "@/contexts/CartContext";
import { useSession } from "next-auth/react";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  vendor: string;
  rating: number;
  category: string;
}

interface ProductPageClientProps {
  product: Product;
  relatedProducts: Product[];
}

export default function ProductPageClient({ product, relatedProducts }: ProductPageClientProps) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const { data: session } = useSession();

  const handleAddToCart = () => {
    addToCart(product.id, quantity);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/products"
          className="flex items-center text-sm text-gray-500 hover:text-violet-600"
        >
          ← Back to Products
        </Link>
      </div>

      {/* Main Product Section */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* Product Images */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border">
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={`thumb-${i}`}
                className={`cursor-pointer overflow-hidden rounded-md border ${i === 1 ? 'border-violet-500 ring-2 ring-violet-500/20' : ''}`}
              >
                <img
                  src={product.image}
                  alt={`Product view ${i}`}
                  className="aspect-square h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Product Details */}
        <div>
          <div className="mb-2 flex items-center">
            <span className="text-sm font-medium text-gray-500">{product.category}</span>
            <span className="mx-2 text-gray-300">•</span>
            <div className="flex items-center text-yellow-400">
              <span className="mr-1 text-sm font-medium">{product.rating}</span>
              <span>★</span>
              <span className="ml-1 text-sm text-gray-500">(124 reviews)</span>
            </div>
          </div>

          <h1 className="mb-2 text-3xl font-bold">{product.name}</h1>
          <p className="mb-4 text-gray-600">{product.description}</p>

          <div className="mb-6">
            <p className="text-3xl font-bold text-violet-600">${product.price.toFixed(2)}</p>
            <p className="text-sm text-gray-500">
              Free shipping on orders over $50
            </p>
          </div>

          {/* Vendor Information */}
          <div className="mb-6 flex items-center">
            <div className="mr-3 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold">
              {product.vendor.charAt(0)}
            </div>
            <div>
              <p className="font-medium">Sold by {product.vendor}</p>
              <div className="flex items-center text-sm text-gray-500">
                <span className="flex items-center text-yellow-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={`vendor-star-${star}`}>★</span>
                  ))}
                </span>
                <span className="ml-1">Trusted Vendor</span>
              </div>
            </div>
          </div>

          {/* Purchase Options */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-r-none"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                -
              </Button>
              <div className="flex h-10 w-14 items-center justify-center border-x-0 border-y">
                {quantity}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-l-none"
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm">In Stock: <span className="font-medium text-green-600">Yes</span></p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {session?.user?.role === "user" ? (
              <Button className="flex-1" onClick={handleAddToCart}>
                Add to Cart
              </Button>
            ) : (
              <Button asChild className="flex-1">
                <Link href="/auth/login">Login to Purchase</Link>
              </Button>
            )}
            <Button variant="secondary" className="flex-1">Buy Now</Button>
            <Button variant="outline" size="icon">
              ♡
            </Button>
          </div>

          {/* Key Features */}
          <div className="mt-8">
            <h3 className="mb-3 text-lg font-medium">Key Features</h3>
            <ul className="list-inside list-disc space-y-1 text-gray-600">
              <li>Premium quality materials</li>
              <li>12-month warranty</li>
              <li>Free returns within 30 days</li>
              <li>Eco-friendly packaging</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Product Information Tabs */}
      <div className="mt-12">
        <Tabs defaultValue="description">
          <TabsList className="mb-4 grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="specifications">Specifications</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="rounded-lg border p-6">
            <h3 className="mb-4 text-xl font-semibold">Product Description</h3>
            <div className="prose max-w-none">
              <p>
                {product.description} Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam
                auctor, nisl eget ultricies aliquam, nunc nisl aliquet nunc, quis
                aliquam nisl nunc quis nisl. Nullam auctor, nisl eget ultricies aliquam,
                nunc nisl aliquet nunc, quis aliquam nisl nunc quis nisl.
              </p>
              <p className="mt-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam
                auctor, nisl eget ultricies aliquam, nunc nisl aliquet nunc, quis
                aliquam nisl nunc quis nisl. Nullam auctor, nisl eget ultricies aliquam,
                nunc nisl aliquet nunc, quis aliquam nisl nunc quis nisl.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="specifications" className="rounded-lg border p-6">
            <h3 className="mb-4 text-xl font-semibold">Product Specifications</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 font-medium">Technical Details</h4>
                <div className="space-y-1">
                  {[
                    { label: "Weight", value: "0.5 kg" },
                    { label: "Dimensions", value: "10 x 5 x 2 cm" },
                    { label: "Material", value: "Aluminum, Plastic" },
                    { label: "Color", value: "Space Gray" },
                  ].map((spec) => (
                    <div key={`spec-${spec.label}`} className="flex">
                      <span className="w-32 font-medium">{spec.label}:</span>
                      <span>{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-medium">Additional Information</h4>
                <div className="space-y-1">
                  {[
                    { label: "Brand", value: product.vendor },
                    { label: "Model", value: `${product.vendor}-${product.id}` },
                    { label: "Warranty", value: "12 Months" },
                    { label: "In Box", value: "Product, Manual, Warranty Card" },
                  ].map((spec) => (
                    <div key={`add-spec-${spec.label}`} className="flex">
                      <span className="w-32 font-medium">{spec.label}:</span>
                      <span>{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="rounded-lg border p-6">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="md:w-1/3">
                <h3 className="mb-2 text-xl font-semibold">Customer Reviews</h3>
                <div className="mb-4">
                  <div className="flex items-center text-3xl text-yellow-400">
                    <span>{product.rating}</span>
                    <span className="ml-1">★</span>
                  </div>
                  <p className="text-sm text-gray-500">Based on 124 reviews</p>
                </div>

                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <div key={`rating-${rating}`} className="flex items-center">
                      <div className="flex w-20 items-center">
                        <span className="mr-1">{rating}</span>
                        <span className="text-yellow-400">★</span>
                      </div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-yellow-400"
                          style={{
                            width: `${rating === 5 ? 70 : rating === 4 ? 20 : rating === 3 ? 5 : rating === 2 ? 3 : 2}%`
                          }}
                        />
                      </div>
                      <span className="ml-2 w-12 text-xs text-gray-500">
                        {rating === 5 ? 70 : rating === 4 ? 20 : rating === 3 ? 5 : rating === 2 ? 3 : 2}%
                      </span>
                    </div>
                  ))}
                </div>

                <Button className="mt-6 w-full">Write a Review</Button>
              </div>

              <div className="flex-1 space-y-6">
                {[
                  {
                    id: "review1",
                    name: "Sarah J.",
                    rating: 5,
                    date: "3 days ago",
                    comment: "This product exceeded my expectations! The quality is outstanding and the shipping was super fast."
                  },
                  {
                    id: "review2",
                    name: "Michael T.",
                    rating: 4,
                    date: "1 week ago",
                    comment: "Good product overall. The only reason I'm giving 4 stars is because the color is slightly different than pictured."
                  },
                  {
                    id: "review3",
                    name: "Emily R.",
                    rating: 5,
                    date: "2 weeks ago",
                    comment: "Absolutely love it! Will definitely buy more from this vendor in the future."
                  }
                ].map((review) => (
                  <div key={review.id} className="border-b pb-6 last:border-b-0">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center font-medium text-violet-800">
                          {review.name.charAt(0)}
                        </div>
                        <span className="font-medium">{review.name}</span>
                      </div>
                      <span className="text-sm text-gray-500">{review.date}</span>
                    </div>
                    <div className="mb-2 flex text-yellow-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={`review-${review.id}-star-${star}`} className={star <= review.rating ? "" : "text-gray-300"}>
                          ★
                        </span>
                      ))}
                    </div>
                    <p className="text-gray-600">{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Related Products */}
      <div className="mt-12">
        <h2 className="mb-6 text-2xl font-bold">Related Products</h2>
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {relatedProducts.map((relatedProduct) => (
            <Card key={relatedProduct.id} className="overflow-hidden">
              <div className="aspect-[4/3] w-full overflow-hidden">
                <img
                  src={relatedProduct.image}
                  alt={relatedProduct.name}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="mb-1 line-clamp-1 font-medium">
                  {relatedProduct.name}
                </h3>
                <div className="mb-3 flex items-center text-sm">
                  <div className="flex text-yellow-400">
                    <span>{relatedProduct.rating}</span>
                    <span className="ml-1">★</span>
                  </div>
                  <span className="mx-2 text-gray-300">•</span>
                  <span className="text-gray-500">by {relatedProduct.vendor}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-violet-600">
                    ${relatedProduct.price.toFixed(2)}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/products/${relatedProduct.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
