"use client";

import { useSession } from "next-auth/react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function getProductImage(images: unknown): string {
  if (Array.isArray(images)) {
    const first = images.find((image) => typeof image === "string" && image.trim().length > 0);
    return first || "/placeholder-product.jpg";
  }

  if (typeof images === "string") {
    const trimmed = images.trim();
    if (!trimmed) {
      return "/placeholder-product.jpg";
    }

    // Support both raw URLs and legacy JSON-stringified arrays.
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const first = parsed.find((image) => typeof image === "string" && image.trim().length > 0);
          return first || "/placeholder-product.jpg";
        }
      } catch {
        return "/placeholder-product.jpg";
      }
    }

    return trimmed;
  }

  return "/placeholder-product.jpg";
}

export default function CartPage() {
  const { status } = useSession();
  const { items, updateQuantity, removeFromCart, getCartTotal, getCartCount } = useCart();

  if (status === "loading") {
    return <div className="container p-8">Loading...</div>;
  }

  // Cart page is always accessible, no redirect for unauthenticated users

  const cartCount = getCartCount();
  const cartTotal = getCartTotal();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Shopping Cart</h1>
        <p className="text-gray-500">{cartCount > 0 ? `${cartCount} item${cartCount > 1 ? "s" : ""} in your cart` : "Your cart is empty"}</p>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-16">
          <div className="mb-4 text-6xl">🛒</div>
          <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
          <Button asChild>
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 items-center border rounded-lg p-4 mb-2">
              <img
                src={getProductImage(item.product?.images)}
                alt={item.product?.name || "Cart product"}
                className="h-16 w-16 object-cover rounded"
              />
              <div className="flex-1">
                <h3 className="font-semibold">{item.product?.name || "Product unavailable"}</h3>
                <div className="text-xs text-gray-500">by {item.product?.vendor?.storeName || item.product?.vendor?.name || "Unknown vendor"}</div>
                <div className="font-medium text-violet-600 mt-1">${Number(item.product?.price || 0).toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} disabled={item.quantity <= 1}>-</Button>
                <span>{item.quantity}</span>
                <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.id)} className="text-red-600">Remove</Button>
            </div>
          ))}
          <div className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t pt-6">
            <div>
              <p className="text-xl font-semibold">Total: <span className="text-violet-600">${cartTotal.toFixed(2)}</span></p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/products">Continue Shopping</Link>
              </Button>
              <Button asChild>
                <Link href="/checkout">Proceed to Checkout</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
