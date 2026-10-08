import type { ReactNode } from "react";

import {
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { SITE_SOCIAL_LINKS, type SiteSocialLink } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/**
 * Which icon draws which social label — Instagram, Facebook, TikTok, WhatsApp.
 *
 * A label with no icon here is skipped, and a social with no `href` yet renders
 * as a disabled placeholder rather than a dead link.
 */
const SOCIAL_ICONS: Record<string, (props: { className?: string }) => ReactNode> = {
  Instagram: InstagramIcon,
  Facebook: FacebookIcon,
  TikTok: TikTokIcon,
  WhatsApp: WhatsAppIcon,
};

/**
 * The social links, in the two shapes they are used in:
 *
 * - `row` (the default) — the horizontal icon-only row the /contact page uses,
 *   with a disabled placeholder for a network whose link is not set yet.
 * - `list` — the footer's FOLLOW column: a vertical list of icon + platform
 *   name rows that sits in the same rhythm as the SHOP and CONTACT columns.
 *   Each row is one link (same URL, target and rel as the row variant) and
 *   carries the caller's `linkClassName`, which is where the footer's hover
 *   state comes from. Unlike the row variant, a network with no `href` is not
 *   rendered at all here — a disabled placeholder inside a text list reads as a
 *   broken entry, and the row variant already covers that case on /contact.
 *
 * The caller passes the merged list from `getStoreDetails()` — settings where
 * they are set, `site-config.ts` where they are not — so the footer and the
 * contact page cannot show different networks on the same visit.
 */
export default function SocialLinks({
  links = SITE_SOCIAL_LINKS,
  className,
  variant = "row",
  linkClassName,
}: {
  links?: SiteSocialLink[];
  className?: string;
  variant?: "row" | "list";
  /** `list` only: the anchor styling (hover state) supplied by the footer. */
  linkClassName?: string;
}) {
  if (variant === "list") {
    return (
      <ul className={cn("space-y-3", className)}>
        {links.map((social) => {
          const Icon = SOCIAL_ICONS[social.label];
          if (!Icon || !social.href) return null;

          return (
            <li key={social.label}>
              <a
                href={social.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`${social.label} (opens in a new tab)`}
                className={cn(
                  "group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum",
                  linkClassName,
                )}
              >
                {/*
                  `h-9 w-9` keeps the icon circle at 36px so the four rows match
                  the line rhythm of the SHOP list beside them; the plum border
                  on hover follows the anchor, which is the whole row.
                */}
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 transition-colors group-hover:border-plum"
                >
                  <Icon />
                </span>
                <span>{social.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className={`flex items-center gap-2 ${className ?? ""}`}>
      {links.map((social) => {
        const Icon = SOCIAL_ICONS[social.label];
        if (!Icon) return null;

        return (
          <li key={social.label}>
            {social.href ? (
              <a
                href={social.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={social.label}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-black/15 transition-colors hover:border-plum hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
              >
                <Icon />
              </a>
            ) : (
              <span
                aria-label={`${social.label} (link not set yet)`}
                title={`${social.label} — link not set yet`}
                className="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-full border border-black/10 text-black/30"
              >
                <Icon />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
