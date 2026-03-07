"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, FocusEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  BarChart3,
  ChevronDown,
  Home,
  LayoutGrid,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  User,
  Users,
  X,
} from "lucide-react";

type HeaderLink = {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
};

const PRIMARY_LINKS: HeaderLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/products", label: "Shop", icon: ShoppingBag },
  { href: "/vendors", label: "Vendors", icon: Store },
  { href: "/orders", label: "Orders", icon: Package },
];

const CATEGORY_LINKS: HeaderLink[] = [
  { href: "/categories/electronics", label: "Electronics" },
  { href: "/categories/fashion", label: "Fashion" },
  { href: "/categories/home-garden", label: "Home & Garden" },
  { href: "/categories/beauty-health", label: "Beauty & Health" },
  { href: "/categories/sports-outdoors", label: "Sports & Outdoors" },
  { href: "/categories/books-media", label: "Books & Media" },
];

export default function Header() {
  const { data: session, status } = useSession();
  const { getCartCount } = useCart();
  const router = useRouter();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileCategoriesOpen, setIsMobileCategoriesOpen] = useState(false);
  const [isDesktopCategoriesOpen, setIsDesktopCategoriesOpen] = useState(false);
  const [isTabletCategoriesOpen, setIsTabletCategoriesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const desktopCategoryRef = useRef<HTMLDivElement | null>(null);
  const tabletCategoryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      setIsMobileCategoriesOpen(false);
    }
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDesktopCategoriesOpen(false);
        setIsTabletCategoriesOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setHasScrolled(window.scrollY > 8);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setIsMobileCategoriesOpen(false);
    setIsDesktopCategoriesOpen(false);
    setIsTabletCategoriesOpen(false);
  };
  const trimmedDebouncedSearch = debouncedSearch.trim();
  const isSearching = searchQuery !== debouncedSearch;

  const submitSearch = () => {
    const query = searchQuery.trim();
    if (!query) {
      router.push("/products");
      return;
    }

    router.push(`/products?q=${encodeURIComponent(query)}`);
  };

  const clearSearch = () => {
    setSearchQuery("");
    router.push("/products");
  };

  const displayName = session?.user?.name || "User";
  const cartCount = session?.user?.role === "user" ? getCartCount() : 0;

  const accountHref = session?.user ? "/account" : "/auth/login";

  const vendorMenu = useMemo(
    () => [
      { href: "/vendors/dashboard", label: "Vendor Dashboard", icon: Store },
      { href: "/vendors/dashboard/products", label: "My Products", icon: LayoutGrid },
      { href: "/vendors/dashboard/orders", label: "Orders", icon: Package },
      { href: "/vendors/dashboard", label: "Analytics", icon: BarChart3 },
    ],
    []
  );

  const adminMenu = useMemo(
    () => [
      { href: "/admin/dashboard", label: "Admin Dashboard", icon: Settings },
      { href: "/admin/vendors", label: "Vendor Approvals", icon: Users },
      { href: "/admin/dashboard#products", label: "Product Approvals", icon: LayoutGrid },
      { href: "/admin/security", label: "Platform Settings", icon: Settings },
    ],
    []
  );

  const handleLogout = () => {
    void signOut({ callbackUrl: "/" });
  };

  const onDesktopCategoryBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!desktopCategoryRef.current?.contains(event.relatedTarget as Node | null)) {
      setIsDesktopCategoriesOpen(false);
    }
  };

  const onTabletCategoryBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!tabletCategoryRef.current?.contains(event.relatedTarget as Node | null)) {
      setIsTabletCategoriesOpen(false);
    }
  };

  const toggleDesktopCategories = () => {
    setIsDesktopCategoriesOpen((prev) => !prev);
  };

  const onDesktopCategoryTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDesktopCategories();
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsDesktopCategoriesOpen(true);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsDesktopCategoriesOpen(false);
    }
  };

  const onTabletCategoryTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsTabletCategoriesOpen((prev) => !prev);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsTabletCategoriesOpen(false);
    }
  };

  return (
    <header
      className={`relative sticky inset-x-0 top-0 z-50 border-b border-orange-100 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 ${
        hasScrolled ? "shadow-[0_6px_18px_-10px_rgba(15,23,42,0.4)]" : ""
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-3 lg:h-[72px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" onClick={closeMobileMenu} aria-label="Felbastore Home">
            <span className="text-xl font-bold text-[#e16b22] sm:text-2xl">Felba</span>
            <span className="text-xl font-bold sm:text-2xl">store</span>
          </Link>

          <div className="mx-4 hidden flex-1 lg:flex lg:max-w-xl">
            <div className="relative w-full">
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitSearch();
                  }
                }}
                aria-label="Search products"
                className="h-11 rounded-full border-orange-200 pr-20 focus-visible:ring-[#e16b22]"
              />
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-9 top-0 h-full px-3"
                onClick={submitSearch}
                aria-label="Submit product search"
              >
                <ShoppingBag className="h-4 w-4" />
              </Button>
              {trimmedDebouncedSearch.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={clearSearch}
                  aria-label="Clear product search"
                >
                  ✕
                </Button>
              )}
              {isSearching && <span className="absolute -bottom-5 left-1 text-xs text-muted-foreground">Searching...</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/cart"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-orange-50 hover:text-[#e16b22]"
              aria-label={`Cart${cartCount > 0 ? ` with ${cartCount} items` : ""}`}
            >
              <span className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#e16b22] text-[10px] text-white">
                    {cartCount}
                  </span>
                )}
              </span>
              <span className="hidden lg:inline">Cart</span>
            </Link>

            {status === "loading" ? (
              <div className="hidden items-center gap-2 sm:flex">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#e16b22]" />
              </div>
            ) : session?.user ? (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-sm text-muted-foreground">Welcome, {displayName}</span>
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
                          <Link href="/admin/vendors">Vendor Approvals</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/dashboard#products">Product Approvals</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/security">Admin Security</Link>
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
                          <Link href="/vendors/dashboard/orders">Orders</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/vendors/dashboard">Analytics</Link>
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
                          <Link href="/products/featured">Wishlist</Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/help">Settings</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
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
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <div className="hidden items-center justify-between border-t border-orange-100 py-2 md:flex">
          <nav aria-label="Primary marketplace navigation" className="flex items-center gap-1" role="navigation">
            {PRIMARY_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-orange-50 hover:text-[#e16b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e16b22]"
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  {link.label}
                </Link>
              );
            })}

            <div
              ref={tabletCategoryRef}
              className="relative lg:hidden"
              onBlur={onTabletCategoryBlur}
            >
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px] gap-2 rounded-md px-3 text-sm font-medium"
                aria-haspopup="menu"
                aria-expanded={isTabletCategoriesOpen}
                aria-controls="tablet-categories-menu"
                onClick={() => setIsTabletCategoriesOpen((prev) => !prev)}
                onKeyDown={onTabletCategoryTriggerKeyDown}
              >
                <LayoutGrid className="h-4 w-4" />
                Categories
                <ChevronDown className="h-4 w-4" />
              </Button>

              {isTabletCategoriesOpen && (
                <div
                  id="tablet-categories-menu"
                  role="menu"
                  aria-label="Tablet categories"
                  className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border bg-background p-2 shadow-xl"
                >
                  {CATEGORY_LINKS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      className="flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm hover:bg-orange-50"
                      onClick={() => setIsTabletCategoriesOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div
              ref={desktopCategoryRef}
              className="relative hidden lg:block"
              onMouseEnter={() => setIsDesktopCategoriesOpen(true)}
              onMouseLeave={() => setIsDesktopCategoriesOpen(false)}
              onBlur={onDesktopCategoryBlur}
            >
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px] gap-2 rounded-md px-3 text-sm font-medium"
                aria-haspopup="menu"
                aria-expanded={isDesktopCategoriesOpen}
                aria-controls="desktop-categories-menu"
                onFocus={() => setIsDesktopCategoriesOpen(true)}
                onClick={toggleDesktopCategories}
                onKeyDown={onDesktopCategoryTriggerKeyDown}
              >
                <LayoutGrid className="h-4 w-4" />
                Categories
                <ChevronDown className="h-4 w-4" />
              </Button>

              {isDesktopCategoriesOpen && (
                <div
                  id="desktop-categories-menu"
                  role="menu"
                  aria-label="Desktop categories"
                  className="absolute left-0 top-full z-50 mt-2 w-[560px] rounded-2xl border bg-background p-4 shadow-2xl"
                >
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Browse Categories</p>
                      <div className="grid gap-1">
                        {CATEGORY_LINKS.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            role="menuitem"
                            className="flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm hover:bg-orange-50"
                            onClick={() => setIsDesktopCategoriesOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-100 p-4">
                      <p className="text-sm font-semibold">Marketplace Highlights</p>
                      <p className="mt-1 text-xs text-muted-foreground">Find trusted vendors, track orders by store, and discover curated deals.</p>
                      <div className="mt-3 grid gap-2">
                        <Link href="/products/featured" className="rounded-md bg-white px-3 py-2 text-sm font-medium hover:bg-orange-100" onClick={() => setIsDesktopCategoriesOpen(false)}>
                          Featured Products
                        </Link>
                        <Link href="/deals" className="rounded-md bg-white px-3 py-2 text-sm font-medium hover:bg-orange-100" onClick={() => setIsDesktopCategoriesOpen(false)}>
                          Daily Deals
                        </Link>
                        <Link href="/vendors" className="rounded-md bg-white px-3 py-2 text-sm font-medium hover:bg-orange-100" onClick={() => setIsDesktopCategoriesOpen(false)}>
                          Top Vendors
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>

          <div className="hidden items-center gap-1 lg:flex">
            <Link
              href={accountHref}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-[#e16b22]"
            >
              <User className="h-4 w-4" />
              Account
            </Link>
          </div>
        </div>

        <div className="pb-3 md:hidden">
          <div className="relative w-full">
            <Input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitSearch();
                }
              }}
              aria-label="Search products"
              className="h-11 rounded-full border-orange-200 pr-20 focus-visible:ring-[#e16b22]"
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-9 top-0 h-full px-3"
              onClick={submitSearch}
              aria-label="Submit product search"
            >
              <ShoppingBag className="h-4 w-4" />
            </Button>
            {trimmedDebouncedSearch.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-0 top-0 h-full px-3"
                onClick={clearSearch}
                aria-label="Clear product search"
              >
                ✕
              </Button>
            )}
          </div>
          {isSearching && <p className="mt-1 text-xs text-muted-foreground">Searching...</p>}
        </div>

        <div
          className={`absolute left-0 top-full z-[100] w-full transition-all duration-300 md:hidden ${
            isMobileMenuOpen ? "pointer-events-auto visible opacity-100" : "pointer-events-none invisible opacity-0"
          }`}
          aria-hidden={!isMobileMenuOpen}
        >
          <nav
            id="mobile-navigation"
            role="navigation"
            aria-label="Mobile navigation"
            className={`w-full border-t border-orange-100 bg-background px-4 pb-8 pt-5 shadow-2xl transition-transform duration-300 ease-out ${
              isMobileMenuOpen ? "translate-y-0" : "-translate-y-2"
            }`}
          >
            <div className="mb-4 flex items-center justify-between border-b border-orange-100 pb-3">
              <p className="text-lg font-semibold">Menu</p>
              <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]" onClick={closeMobileMenu}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <ul className="space-y-1" role="menu" aria-label="Primary mobile links">
              {[
                { href: "/", label: "Home", icon: Home },
                { href: "/products", label: "Shop", icon: ShoppingBag },
                { href: "/vendors", label: "Vendors", icon: Store },
                { href: "/orders", label: "Orders", icon: Package },
                { href: "/cart", label: "Cart", icon: ShoppingCart },
                { href: accountHref, label: "Account", icon: User },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      role="menuitem"
                      className="flex min-h-[48px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e16b22]"
                      onClick={closeMobileMenu}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  </li>
                );
              })}

              <li>
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={isMobileCategoriesOpen}
                  aria-controls="mobile-categories-accordion"
                  className="flex min-h-[48px] w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e16b22]"
                  onClick={() => setIsMobileCategoriesOpen((prev) => !prev)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setIsMobileCategoriesOpen(false);
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-3">
                    <LayoutGrid className="h-4 w-4" />
                    Categories
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isMobileCategoriesOpen ? "rotate-180" : ""}`} />
                </button>

                <div
                  id="mobile-categories-accordion"
                  role="menu"
                  aria-label="Mobile categories"
                  className={`overflow-hidden pl-4 transition-[max-height,opacity] duration-300 ease-out ${
                    isMobileCategoriesOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <ul className="space-y-1 py-1">
                    {CATEGORY_LINKS.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          role="menuitem"
                          className="flex min-h-[48px] items-center rounded-md px-3 py-2 text-sm hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e16b22]"
                          onClick={closeMobileMenu}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            </ul>

            {session?.user?.role === "vendor" && (
              <div className="mt-5 rounded-xl border border-orange-100 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor Tools</p>
                <div className="space-y-1" role="menu" aria-label="Vendor links">
                  {vendorMenu.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        role="menuitem"
                        className="flex min-h-[48px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-orange-50"
                        onClick={closeMobileMenu}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {session?.user?.role === "admin" && (
              <div className="mt-5 rounded-xl border border-orange-100 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin Tools</p>
                <div className="space-y-1" role="menu" aria-label="Admin links">
                  {adminMenu.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        role="menuitem"
                        className="flex min-h-[48px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-orange-50"
                        onClick={closeMobileMenu}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {!session?.user ? (
              <div className="mt-6 grid gap-2 border-t border-orange-100 pt-4">
                <Button asChild variant="outline" className="min-h-[48px] w-full" onClick={closeMobileMenu}>
                  <Link href="/auth/login">Login</Link>
                </Button>
                <Button asChild className="min-h-[48px] w-full" onClick={closeMobileMenu}>
                  <Link href="/auth/register">Register</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-6 grid gap-2 border-t border-orange-100 pt-4">
                <p className="px-3 text-sm text-muted-foreground">Welcome, {displayName}</p>
                <Button variant="outline" className="min-h-[48px] w-full" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
