"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "@/contexts/CartContext";

export default function Header() {
  const { data: session, status } = useSession();
  const { getCartCount } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" onClick={closeMobileMenu}>
            <span className="text-xl font-bold text-[#e16b22] sm:text-2xl">Felba</span>
            <span className="text-xl font-bold sm:text-2xl">store</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="mx-6 hidden flex-1 md:block">
            <ul className="flex gap-6">
              <li>
                <Link href="/products" className="text-sm font-medium hover:text-[#e16b22]">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-sm font-medium hover:text-[#e16b22]">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/vendors" className="text-sm font-medium hover:text-[#e16b22]">
                  Vendors
                </Link>
              </li>
              <li>
                <Link href="/deals" className="text-sm font-medium hover:text-[#e16b22]">
                  Today's Deals
                </Link>
              </li>
            </ul>
          </nav>

          {/* Search Bar */}
          <div className="hidden flex-1 lg:flex">
            <div className="relative w-full max-w-sm">
              <Input
                type="search"
                placeholder="Search products..."
                className="pr-10"
              />
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-0 top-0 h-full px-3"
              >
                🔍
              </Button>
            </div>
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cart */}
            <Link href="/cart" className="flex items-center gap-1 text-sm font-medium hover:text-[#e16b22]">
              <span className="relative">
                🛒
                {session?.user?.role === "user" && getCartCount() > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#e16b22] text-[10px] text-white">
                    {getCartCount()}
                  </span>
                )}
              </span>
              <span className="hidden sm:inline">Cart</span>
            </Link>

            {/* Account */}
            {session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                    <Avatar>
                      <AvatarFallback>
                        {session.user.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {session.user.role === "admin" ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/dashboard">Admin Dashboard</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/dashboard#users">Manage Users</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/dashboard#vendors">Manage Vendors</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/dashboard#products">Manage Products</Link>
                      </DropdownMenuItem>
                    </>
                  ) : session.user.role === "vendor" ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/vendors/dashboard">Vendor Dashboard</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/vendors/dashboard/products">My Products</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/vendors/dashboard">My Orders</Link>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/orders">My Account</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/orders">My Orders</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/products/featured">Wishlist</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/help">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/auth/login">Login</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth/register">Register</Link>
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px] min-w-[44px] md:hidden"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              {isMobileMenuOpen ? "✕" : "☰"}
            </Button>
          </div>
        </div>

        {/* Mobile Search - Visible only on mobile */}
        <div className="pb-3 lg:hidden">
          <div className="relative w-full">
            <Input
              type="search"
              placeholder="Search products..."
              className="pr-10"
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-0 top-0 h-full px-3"
            >
              🔍
            </Button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu overlay"
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={closeMobileMenu}
            />
            <nav
              id="mobile-navigation"
              className="fixed right-0 top-0 z-50 h-full w-[85vw] max-w-sm overflow-y-auto border-l bg-background p-4 shadow-xl md:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-lg font-semibold">Menu</p>
                <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]" onClick={closeMobileMenu}>
                  ✕
                </Button>
              </div>

              <ul className="space-y-2">
                <li>
                  <Link href="/products" className="block rounded px-3 py-3 text-sm font-medium hover:bg-muted" onClick={closeMobileMenu}>
                    All Products
                  </Link>
                </li>
                <li>
                  <Link href="/categories" className="block rounded px-3 py-3 text-sm font-medium hover:bg-muted" onClick={closeMobileMenu}>
                    Categories
                  </Link>
                </li>
                <li>
                  <Link href="/vendors" className="block rounded px-3 py-3 text-sm font-medium hover:bg-muted" onClick={closeMobileMenu}>
                    Vendors
                  </Link>
                </li>
                <li>
                  <Link href="/deals" className="block rounded px-3 py-3 text-sm font-medium hover:bg-muted" onClick={closeMobileMenu}>
                    Today's Deals
                  </Link>
                </li>
                {session?.user?.role === "admin" && (
                  <li>
                    <Link href="/admin/dashboard" className="block rounded px-3 py-3 text-sm font-medium hover:bg-muted" onClick={closeMobileMenu}>
                      Admin Dashboard
                    </Link>
                  </li>
                )}
                {session?.user?.role === "vendor" && (
                  <li>
                    <Link href="/vendors/dashboard" className="block rounded px-3 py-3 text-sm font-medium hover:bg-muted" onClick={closeMobileMenu}>
                      Vendor Dashboard
                    </Link>
                  </li>
                )}
              </ul>

              {!session?.user && (
                <div className="mt-6 grid gap-2">
                  <Button asChild variant="outline" className="w-full" onClick={closeMobileMenu}>
                    <Link href="/auth/login">Login</Link>
                  </Button>
                  <Button asChild className="w-full" onClick={closeMobileMenu}>
                    <Link href="/auth/register">Register</Link>
                  </Button>
                </div>
              )}
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
