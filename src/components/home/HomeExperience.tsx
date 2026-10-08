"use client";

import { useCallback, useEffect, useState } from "react";

import CategorySlider from "@/components/home/CategorySlider";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import Navbar from "@/components/layout/Navbar";
import type { HomeAnnouncement, HomeCategorySlide } from "@/lib/home-data";
import {
  HEADER_TONE_FALLBACK,
  measureHeaderTone,
  type HeaderTone,
} from "@/lib/header-tone";
import type { MenuCategory } from "@/lib/menu-data";
import type { StoreDetails } from "@/lib/site-config";

type HomeExperienceProps = {
  categories: HomeCategorySlide[];
  announcements: HomeAnnouncement[];
  /** Navigation tree for the hamburger menu. */
  menuCategories: MenuCategory[];
  /** The footer slide's store details, read once on the server. */
  details: StoreDetails;
};

/**
 * Fixed full-screen stack: the category slider fills the viewport from the very
 * top, and the transparent announcement bar + navbar float above it (the footer
 * is the last slide). Nothing reserves layout space for the chrome, so hiding it
 * over the footer slide never shifts the page.
 *
 * The two floating elements share one adaptive colour: white until the active
 * slide's image has been measured, then white or black depending on the
 * luminance of the strip behind them (see `lib/header-tone`).
 */
export default function HomeExperience({
  categories,
  announcements,
  menuCategories,
  details,
}: HomeExperienceProps) {
  const [footerActive, setFooterActive] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [headerTone, setHeaderTone] = useState<HeaderTone>(
    HEADER_TONE_FALLBACK,
  );

  const handleFooterActiveChange = useCallback((active: boolean) => {
    setFooterActive(active);
  }, []);

  const handleActiveImageUrlChange = useCallback((imageUrl: string | null) => {
    setActiveImageUrl(imageUrl);
  }, []);

  useEffect(() => {
    if (!activeImageUrl) return;

    let cancelled = false;

    measureHeaderTone(activeImageUrl).then((tone) => {
      if (!cancelled) setHeaderTone(tone);
    });

    return () => {
      cancelled = true;
    };
  }, [activeImageUrl]);

  return (
    <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-white">
      <AnnouncementBar
        announcements={announcements}
        hidden={footerActive}
        tone={headerTone}
      />
      <Navbar
        hidden={footerActive}
        menuCategories={menuCategories}
        overlayTone={headerTone}
      />
      <CategorySlider
        categories={categories}
        details={details}
        onFooterActiveChange={handleFooterActiveChange}
        onActiveImageUrlChange={handleActiveImageUrlChange}
      />
    </div>
  );
}
