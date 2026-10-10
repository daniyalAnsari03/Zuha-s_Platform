"use client";

import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import SocialLinks from "@/components/layout/SocialLinks";
import { STORE_POLICY_LINKS } from "@/lib/policy-types";
import { mailtoHref, telHref, type StoreDetails } from "@/lib/site-config";

/**
 * The mobile (below `md`) footer sections: SHOP / CONTACT / FOLLOW / POLICIES as
 * centred accordion rows. Each row is a real `<button>` with `aria-expanded` and
 * `aria-controls`; only one opens at a time, closed by default, exactly like the
 * hamburger's sub-category accordion.
 *
 * The open/close is the CSS `grid-template-rows: 0fr -> 1fr` technique (never
 * `height: auto`), with the panel opacity, and a slow, soft ease-out so the
 * section glides open in slow motion — this is the mobile footer only. The
 * desktop/tablet columns live in `SiteFooterContent`; this component is
 * rendered `md:hidden`.
 */
const ACCORDION_DURATION = "0.65s";

const BODY_CLASS =
  "flex w-full flex-col items-center text-center text-[13px] tracking-[0.08em] text-black/70 uppercase [overflow-wrap:anywhere]";

const LINK_CLASS =
  "flex min-h-11 w-full items-center justify-center px-2 text-center underline-offset-4 transition-colors hover:text-plum hover:underline";

const PANEL_TRANSITION = `grid-template-rows ${ACCORDION_DURATION} var(--motion-ease), opacity ${ACCORDION_DURATION} var(--motion-ease)`;

type MobileFooterAccordionProps = {
  categories: { name: string; slug: string }[];
  details: StoreDetails;
};

export default function MobileFooterAccordion({
  categories,
  details,
}: MobileFooterAccordionProps) {
  const reduceMotion = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  const sections: { id: string; label: string; content: ReactNode }[] = [
    {
      id: "shop",
      label: "Shop",
      content: (
        <ul className={BODY_CLASS}>
          {categories.map((category) => (
            <li key={category.slug} className="w-full">
              <Link
                href={`/category/${category.slug}`}
                className={LINK_CLASS}
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "contact",
      label: "Contact",
      content: (
        <ul className={BODY_CLASS}>
          <li className="w-full">
            <a
              href={mailtoHref(details.contact.email)}
              className={LINK_CLASS}
            >
              {details.contact.email}
            </a>
          </li>
          <li className="w-full">
            <a href={telHref(details.contact.phone)} className={LINK_CLASS}>
              {details.contact.phone}
            </a>
          </li>
          <li className="w-full px-2 leading-relaxed">
            {details.contact.address}
          </li>
        </ul>
      ),
    },
    {
      id: "follow",
      label: "Follow",
      content: (
        <SocialLinks
          links={details.socials}
          variant="list"
          className={BODY_CLASS}
          linkClassName={LINK_CLASS}
        />
      ),
    },
    {
      id: "policies",
      label: "Policies",
      content: (
        <ul className={BODY_CLASS}>
          {STORE_POLICY_LINKS.map(({ slug, label }) => (
            <li key={slug} className="w-full">
              <Link href={`/policies/${slug}`} className={LINK_CLASS}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="w-full md:hidden">
      {sections.map((section) => {
        const expanded = openId === section.id;
        const panelId = `footer-mobile-${section.id}`;

        return (
          <div
            key={section.id}
            className="border-b border-black/10 first:border-t"
          >
            <h2 className="m-0">
              <button
                type="button"
                onClick={() => toggle(section.id)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex min-h-11 w-full items-center justify-center gap-3 py-2 text-center font-sans text-sm tracking-[0.14em] uppercase transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
              >
                <span>{section.label}</span>

                {/*
                  "+" that becomes "−" when open: the vertical bar of the plus
                  scales away on the same slow accordion timing. Transform only.
                */}
                <span
                  aria-hidden="true"
                  className="relative inline-flex h-3 w-3 shrink-0 items-center justify-center"
                >
                  <span className="absolute h-[1.5px] w-3 bg-current" />
                  <span
                    className="absolute h-3 w-[1.5px] bg-current"
                    style={{
                      transform: expanded ? "scaleY(0)" : "scaleY(1)",
                      transition: reduceMotion
                        ? "none"
                        : `transform ${ACCORDION_DURATION} var(--motion-ease)`,
                    }}
                  />
                </span>
              </button>
            </h2>

            {/*
             * The shared accordion technique: only the grid row and the panel
             * opacity change. `inert` keeps a closed section out of the tab
             * order and unreachable.
             */}
            <div
              id={panelId}
              aria-hidden={!expanded}
              inert={!expanded}
              className="grid overflow-hidden"
              style={{
                gridTemplateRows: expanded ? "1fr" : "0fr",
                opacity: expanded ? 1 : 0,
                transition: reduceMotion ? "none" : PANEL_TRANSITION,
              }}
            >
              <div className="min-h-0 pb-6">{section.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
