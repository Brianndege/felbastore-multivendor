import Link from "next/link";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DEALS = [
  {
    id: "d1",
    name: "Deluxe Bluetooth Headphones",
    price: 98.99,
    oldPrice: 149.99,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60",
    vendor: "AudioTech",
    off: 34
  },
  {
    id: "d2",
    name: "Eco Sustainable Jacket",
    price: 59.99,
    oldPrice: 89.99,
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&auto=format&fit=crop&q=60",
    vendor: "EcoWear",
    off: 33
  },
  {
    id: "d3",
    name: "Glow Facial Serum",
    price: 19.99,
    oldPrice: 34.99,
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&auto=format&fit=crop&q=60",
    vendor: "NatureCare",
    off: 43
  },
  {
    id: "d4",
    name: "Handmade Artisan Mug",
    price: 15.99,
    oldPrice: 28.99,
    image: "https://images.unsplash.com/photo-1595185584522-061e4a462262?w=500&auto=format&fit=crop&q=60",
    vendor: "ArtisanCrafts",
    off: 45
  }
];

export default function DealsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[#e16b22]">🔥 Today's Deals</h1>
        <p className="text-gray-600 max-w-xl mx-auto">Don't miss out on our best discounts and special offers available for a limited time only!</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {DEALS.map((deal) => (
          <Card key={deal.id} className="overflow-hidden">
            <div className="aspect-video w-full bg-white">
              <img
                src={deal.image}
                alt={deal.name}
                className="h-full w-full object-cover"
              />
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-1">{deal.name}</h3>
              <div className="mb-2 text-xs text-gray-500">by {deal.vendor}</div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold text-[#e16b22]">${deal.price.toFixed(2)}</span>
                <span className="ml-auto bg-[#e16b22]/10 text-[#e16b22] rounded px-2 py-0.5 text-xs font-medium">-{deal.off}%</span>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="border-[#e16b22] text-[#e16b22] hover:bg-[#e16b22]/10">
                <Link href={`/products/${deal.id}`}>View</Link>
              </Button>
              <Button size="sm" className="bg-[#e16b22] text-white hover:bg-[#cf610d]">
                Add to Cart
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
