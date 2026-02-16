"use client";

import Link from "next/link";
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

  return (
    <header className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#e16b22]">Felba</span>
            <span className="text-2xl font-bold">store</span>
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
          <div className="hidden flex-1 md:flex">
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
          <div className="flex items-center gap-4">
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
              <span className="hidden md:inline">Cart</span>
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
                        <Link href="/admin/users">Manage Users</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/vendors">Manage Vendors</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/products">Manage Products</Link>
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
                        <Link href="/vendors/dashboard/orders">My Orders</Link>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/account">My Account</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/orders">My Orders</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/wishlist">Wishlist</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/account/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/auth/login">Login</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth/register">Register</Link>
                </Button>
              </div>
            )}

            {/* Mobile Menu Button - Would be connected to a mobile menu drawer in a real app */}
            <Button variant="ghost" size="sm" className="md:hidden">
              ☰
            </Button>
          </div>
        </div>

        {/* Mobile Search - Visible only on mobile */}
        <div className="pb-3 md:hidden">
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
      </div>
    </header>
  );
}
