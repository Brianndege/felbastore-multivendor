import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default function FeaturedItemsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#e16b22] mb-4">Featured Items</h1>
      <p className="mb-8 text-gray-600">Our top picks and exclusive deals, hand selected for you!</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1,2,3].map((id) => (
          <Card key={id} className="overflow-hidden">
            <div className="aspect-video w-full bg-white">
              <img
                src={`https://source.unsplash.com/random/400x250?sig=${id}&product`}
                alt="Product"
                className="h-full w-full object-cover"
              />
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-1">Featured Product {id}</h3>
              <p className="text-xs text-gray-500 mb-2">Vendor {id}</p>
              <span className="text-lg text-[#e16b22] font-bold">$99.00</span>
            </CardContent>
            <div className="p-4 pt-0 flex gap-2">
              <Link href="#" className="text-xs text-[#e16b22] underline">View Details</Link>
              <span className="ml-auto text-xs text-gray-500">★4.{9-id}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
