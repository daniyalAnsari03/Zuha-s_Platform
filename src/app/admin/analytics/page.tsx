import { requireAdmin } from "@/lib/admin/guard";
import { getAdminAnalytics } from "@/lib/admin/queries";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";

/**
 * Analytics: four stat cards, one line chart with a 7-day / 30-day / 12-month
 * filter, the top five best sellers and the orders-by-status summary.
 *
 * Every figure is computed on the server from `orders` and `order_items` with
 * cancelled orders excluded, so the page hands the component a finished set of
 * numbers rather than rows to total up in the browser.
 */
export default async function AdminAnalyticsPage() {
  await requireAdmin();

  const analytics = await getAdminAnalytics();

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Analytics
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          Sales, orders and best sellers. Cancelled orders are left out of every
          money figure and out of the chart.
        </p>
      </header>

      <AnalyticsDashboard data={analytics} />
    </section>
  );
}
