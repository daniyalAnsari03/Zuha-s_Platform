"use client";

import { useState } from "react";
/* Admin list thumbnails are plain <img>, not next/image — see ImageUpload.tsx. */
/* eslint-disable @next/next/no-img-element */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ADMIN_BUTTON_CLASS } from "@/components/admin/admin-fields";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import type {
  AdminAnalytics,
  AdminAnalyticsRange,
} from "@/lib/admin/queries";
import { formatAmount, type OrderStatus } from "@/lib/order-types";
import { cn } from "@/lib/utils";

const RANGES: { value: AdminAnalyticsRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
];

/**
 * Analytics: four numbers, one line chart, the top five sellers and the orders
 * by status — nothing more, as the spec asks.
 *
 * Everything is already computed on the server (`getAdminAnalytics`), so this
 * component only renders it. The range buttons switch between three series that
 * arrived with the page; switching back and forth cannot re-fetch or re-total,
 * which keeps the screen instant and impossible to disagree with itself.
 */
export default function AnalyticsDashboard({ data }: { data: AdminAnalytics }) {
  const [range, setRange] = useState<AdminAnalyticsRange>("7d");
  const series = data.series[range];

  const stats = [
    { label: "Total sales", value: formatAmount(data.totalSales) },
    { label: "Total orders", value: String(data.totalOrders) },
    { label: "Total customers", value: String(data.totalCustomers) },
    { label: "Average order value", value: formatAmount(data.averageOrderValue) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-black/10 p-4">
            <p className="text-[0.6875rem] tracking-[0.16em] text-black/50 uppercase">
              {stat.label}
            </p>
            <p className="mt-2 text-lg font-semibold break-words sm:text-2xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs tracking-[0.2em] text-black/50 uppercase">
            Sales over time
          </h2>

          <div className="flex flex-wrap items-center gap-1 border border-black/15 p-1">
            {RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                aria-pressed={range === option.value}
                className={cn(
                  ADMIN_BUTTON_CLASS,
                  "min-h-11 px-3 sm:px-4",
                  range === option.value
                    ? "bg-plum text-white hover:bg-plum"
                    : "text-black/60 hover:text-plum",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border border-black/10 p-3 sm:p-5">
          <div className="h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              >
                <CartesianGrid stroke="#000" strokeOpacity={0.07} vertical={false} />

                <XAxis
                  dataKey="label"
                  tick={{ fill: "#000", fillOpacity: 0.45, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#000", strokeOpacity: 0.12 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />

                <YAxis
                  tick={{ fill: "#000", fillOpacity: 0.45, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(value: number) => formatAmount(value)}
                />

                <Tooltip
                  cursor={{ stroke: "#4a2040", strokeOpacity: 0.35 }}
                  contentStyle={{
                    border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 0,
                    fontSize: 12,
                    boxShadow: "none",
                  }}
                  formatter={(value) => [formatAmount(Number(value)), "Sales"]}
                  labelFormatter={(label) => String(label)}
                />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4a2040"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#4a2040", strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h2 className="text-xs tracking-[0.2em] text-black/50 uppercase">
            Top 5 best sellers
          </h2>

          {data.topProducts.length === 0 ? (
            <p className="border border-dashed border-black/15 px-4 py-8 text-center text-sm text-black/50">
              Nothing has sold yet. Cancelled orders do not count towards these
              totals.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
              {data.topProducts.map((product, index) => (
                <li
                  key={`${product.productId ?? "deleted"}-${index}`}
                  className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4"
                >
                  <span className="w-4 shrink-0 text-xs text-black/40">
                    {index + 1}
                  </span>

                  <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-black/10 bg-black/5 sm:w-12">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        width={48}
                        height={72}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <p className="min-w-0 flex-1 truncate text-sm">
                    {product.name}
                  </p>

                  <p className="shrink-0 text-sm font-medium">
                    {product.units} {product.units === 1 ? "unit" : "units"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xs tracking-[0.2em] text-black/50 uppercase">
            Orders by status
          </h2>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.statusCounts.map((row) => (
              <li
                key={row.status}
                className="flex items-center justify-between gap-3 border border-black/10 p-3 sm:p-4"
              >
                <OrderStatusBadge status={row.status as OrderStatus} />
                <span className="text-sm font-medium">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
