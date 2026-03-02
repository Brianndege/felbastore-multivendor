import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Providers from "./providers";
import { validateRuntimeEnv } from "@/lib/env";

const inter = Inter({ subsets: ["latin"] });
const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://felbastore.com";

validateRuntimeEnv();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Felbastore",
    template: "%s | Felbastore",
  },
  description: "Felbastore – Your one-stop marketplace for unique finds, best deals, and trusted vendors.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Felbastore",
    description: "Felbastore – Your one-stop marketplace for unique finds, best deals, and trusted vendors.",
    url: "/",
    siteName: "Felbastore",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Felbastore",
    description: "Felbastore – Your one-stop marketplace for unique finds, best deals, and trusted vendors.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
