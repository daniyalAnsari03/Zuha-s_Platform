import type { Metadata } from "next";

import SaleListing from "@/components/products/SaleListing";
import { getSaleData } from "@/lib/sale-data";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Sale — ZUHA'S",
  description: "Shop discounted styles at ZUHA'S.",
};

export default async function SalePage() {
  const sale = await getSaleData();

  return <SaleListing products={sale.products} categories={sale.categories} />;
}
