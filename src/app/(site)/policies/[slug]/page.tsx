import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/layout/Breadcrumb";
import { CONTENT_CONTAINER } from "@/lib/content-container";
import { getStorePolicy, getStorePolicySlugs } from "@/lib/policy-data";
import { renderPolicyText } from "@/lib/policy-text";
import {
  isStorePolicySlug,
  STORE_POLICY_TITLES,
} from "@/lib/policy-types";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Static / ISR instead of dynamic: the four policy pages are prerendered at
 * build time and refreshed every five minutes, the same window
 * `DEFAULT_PUBLIC_REVALIDATE` uses for the reader behind them. The segment
 * config must be statically analyzable, so the literal is repeated here rather
 * than imported from `lib/cache-tags.ts`.
 */
export const revalidate = 300;

/**
 * The four fixed routes. Read from the shared const, not the database: the set
 * of policy pages is fixed, so it is the same list the writer validates against.
 */
export function generateStaticParams() {
  return getStorePolicySlugs();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!isStorePolicySlug(slug)) {
    return { title: "Page not found — ZUHA'S" };
  }

  const policy = await getStorePolicy(slug);
  const title = policy?.title ?? STORE_POLICY_TITLES[slug];

  return {
    title: `${title} — ZUHA'S`,
    description: `${title} for ZUHA'S.`,
  };
}

/**
 * One policy page (Privacy Policy, Refund Policy, Terms of Service, Shipping
 * Policy), opened from the footer's POLICIES column, from the checkout policy
 * line, or directly by slug.
 *
 * Any slug outside the fixed four is a 404. The body is rendered as plain text —
 * never `dangerouslySetInnerHTML` — split on blank lines into paragraphs, with
 * single line breaks preserved. A slug whose row is missing or empty shows the
 * empty state rather than a blank page.
 *
 * The navbar, the page spacing and the normal footer all come from the shared
 * `(site)` layout.
 */
export default async function PolicyPage({ params }: PageProps) {
  const { slug } = await params;

  if (!isStorePolicySlug(slug)) notFound();

  const policy = await getStorePolicy(slug);
  const title = policy?.title ?? STORE_POLICY_TITLES[slug];
  const content = policy?.content.trim() ?? "";

  const paragraphs = content
    ? content
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    : [];

  return (
    <section className={cn(CONTENT_CONTAINER, "min-w-0")}>
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: title }]}
        className="min-w-0"
      />

      {/*
        The prose sits in the same shared container as the breadcrumb. Every
        level carries `min-w-0 max-w-full` and `overflow-wrap: anywhere` so a
        very long unbroken string wraps instead of pushing the page sideways —
        no horizontal scrollbar at any width, even with a 500-character word.
      */}
      <div className="mx-auto mt-6 w-full min-w-0 max-w-3xl lg:mt-8">
        <h1 className="max-w-full text-center font-serif text-3xl tracking-[0.08em] break-words [overflow-wrap:anywhere] sm:text-4xl">
          {title}
        </h1>

        {paragraphs.length > 0 ? (
          <div className="mt-8 space-y-5 sm:mt-10">
            {paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className="min-w-0 max-w-full whitespace-pre-line text-sm leading-relaxed break-words text-black/80 [overflow-wrap:anywhere] sm:text-base"
              >
                {renderPolicyText(paragraph)}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-black/50 sm:text-base">
            This page has not been updated yet.
          </p>
        )}
      </div>
    </section>
  );
}
