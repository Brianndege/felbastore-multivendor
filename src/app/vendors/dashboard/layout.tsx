"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { href: "/vendors/dashboard", label: "Overview" },
    { href: "/vendors/dashboard/products", label: "Products" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20">
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <h1 className="text-lg font-semibold">Vendor Dashboard</h1>
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            aria-expanded={menuOpen}
            aria-controls="vendor-sidebar"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? "Close" : "Menu"}
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[240px,1fr]">
          {menuOpen && (
            <button
              type="button"
              aria-label="Close vendor navigation"
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              onClick={() => setMenuOpen(false)}
            />
          )}

          <aside
            id="vendor-sidebar"
            className={`z-40 rounded-lg border bg-background p-3 shadow-sm transition-transform lg:sticky lg:top-20 lg:block lg:h-fit ${
              menuOpen
                ? "fixed left-4 top-20 block w-[calc(100%-2rem)] max-w-xs"
                : "hidden lg:block"
            }`}
          >
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`block rounded-md px-3 py-3 text-sm font-medium transition-colors ${
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0 rounded-lg border bg-background p-3 sm:p-4 md:p-6">{children}</section>
        </div>
      </div>
    </div>
  );
}