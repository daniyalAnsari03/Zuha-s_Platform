import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { CartProvider } from "@/components/cart/CartProvider";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";
import MotionProvider from "@/components/layout/MotionProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zuha",
  description: "Zuha",
};

/**
 * The cart and wishlist providers sit at the very top of the tree, above the
 * route groups, because the navbar that reads them (badge, cart popup, wishlist
 * heart) is rendered by the homepage as well as by the `(site)` layout.
 * `QuickViewProvider` stays in `(site)`, where product cards live.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-black font-sans">
        <MotionProvider>
          <CartProvider>
            <WishlistProvider>{children}</WishlistProvider>
          </CartProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
