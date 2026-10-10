import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { CartProvider } from "@/components/cart/CartProvider";
import { CurrencyProvider } from "@/components/currency/CurrencyProvider";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";
import MotionProvider from "@/components/layout/MotionProvider";
import { getUsdRate } from "@/lib/currency-rate";
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
 *
 * `CurrencyProvider` also sits here: the USD rate is read server-side (cached
 * behind the `store-details` tag) and passed in, so every storefront price —
 * homepage and `(site)` pages alike — can render in the shopper's chosen
 * currency without turning any static page dynamic.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const usdRate = await getUsdRate();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-black font-sans">
        <CurrencyProvider usdRate={usdRate}>
          <MotionProvider>
            <CartProvider>
              <WishlistProvider>{children}</WishlistProvider>
            </CartProvider>
          </MotionProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
