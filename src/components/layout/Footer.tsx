import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Column 1: Logo & About */}
          <div className="lg:col-span-2">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <span className="text-2xl font-bold text-[#e16b22]">Felba</span>
              <span className="text-2xl font-bold text-white">store</span>
            </Link>
            <p className="mb-4 max-w-md text-gray-400">
              Your one-stop marketplace connecting quality vendors with customers across the globe.
              Shop with confidence from thousands of verified vendors.
            </p>
            <div className="flex gap-3">
              {["twitter", "facebook", "instagram", "youtube"].map((social) => (
                <a
                  key={social}
                  href={`https://${social}.com`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-gray-300 transition-colors hover:bg-[#e16b22] hover:text-white"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {social === "twitter" && "𝕏"}
                  {social === "facebook" && "f"}
                  {social === "instagram" && "📸"}
                  {social === "youtube" && "▶"}
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Shop */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">Shop</h3>
            <ul className="space-y-2">
              {[
                { label: "All Products", href: "/products" },
                { label: "Featured Items", href: "/products/featured" },
                { label: "Categories", href: "/categories" },
                { label: "Deals & Discounts", href: "/deals" },
                { label: "New Arrivals", href: "/products/new" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 transition-colors hover:text-violet-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Vendors */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">Vendors</h3>
            <ul className="space-y-2">
              {[
                { label: "Become a Vendor", href: "/vendors/register" },
                { label: "Vendor Directory", href: "/vendors" },
                { label: "Vendor Login", href: "/vendors/login" },
                { label: "Seller Resources", href: "/vendors/resources" },
                { label: "Success Stories", href: "/vendors/stories" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 transition-colors hover:text-violet-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Support & Newsletter */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">Stay Updated</h3>
            <p className="mb-3 text-sm text-gray-400">
              Subscribe to our newsletter for the latest products and deals.
            </p>
            <div className="mb-4 flex">
              <Input
                type="email"
                placeholder="Your email address"
                className="rounded-r-none bg-gray-800 border-gray-700 text-gray-300"
              />
              <Button className="rounded-l-none">
                Subscribe
              </Button>
            </div>
            <h3 className="mb-2 mt-6 text-lg font-semibold text-white">Support</h3>
            <ul className="space-y-2">
              {[
                { label: "Help Center", href: "/help" },
                { label: "Contact Us", href: "/contact" },
                { label: "Returns & Refunds", href: "/returns" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 transition-colors hover:text-violet-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-800 py-6">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Felbastore. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-gray-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-300">Terms of Service</Link>
            <Link href="/cookies" className="hover:text-gray-300">Cookie Settings</Link>
            <Link href="/accessibility" className="hover:text-gray-300">Accessibility</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
