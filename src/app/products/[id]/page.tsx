import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductPageClient from "@/components/products/ProductPageClient";

// Mock data for products - In a real app, this would come from your database
const PRODUCTS = [
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

// Required for static site generation with dynamic routes
export function generateStaticParams() {
  return PRODUCTS.map((product) => ({
    id: product.id,
  }));
}

export default function ProductPage({ params }: { params: { id: string } }) {
  // In a real app, this would fetch from your database or API
  const product = PRODUCTS.find((p) => p.id === params.id);

  if (!product) {
    notFound();
  }

  // Get related products (same category)
  const relatedProducts = PRODUCTS
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <ProductPageClient
      product={product}
      relatedProducts={relatedProducts}
    />
  );
}
