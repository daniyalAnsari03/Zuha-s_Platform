import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_TAGS, DEFAULT_PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";

export type HomeCategorySlide = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  mobileImageUrl: string | null;
};

export type HomeAnnouncement = {
  id: string;
  text: string;
  href: string | null;
};

function isExpectedStaticThrownError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE"
  );
}

async function getHomeCategoriesInternal(): Promise<HomeCategorySlide[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, image_url, mobile_image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const slides: HomeCategorySlide[] = [];

    for (const category of data ?? []) {
      if (!category.image_url) continue;

      slides.push({
        id: category.id,
        name: category.name,
        slug: category.slug,
        imageUrl: category.image_url,
        mobileImageUrl: category.mobile_image_url,
      });
    }

    return slides;
  } catch (error) {
    if (isExpectedStaticThrownError(error)) return [];
    console.error("[home-data] categories query failed.", error);
    throw error;
  }
}

export const getHomeCategories = unstable_cache(
  getHomeCategoriesInternal,
  ["home-categories"],
  {
    tags: [CACHE_TAGS.home, CACHE_TAGS.categories],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  },
);

async function getHomeAnnouncementsInternal(): Promise<HomeAnnouncement[]> {
  try {
    const supabase = createPublicClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, body, link_url, starts_at, ends_at")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? [])
      .filter((announcement) => !announcement.ends_at || announcement.ends_at >= now)
      .map((announcement) => ({
        id: announcement.id,
        text: [announcement.title, announcement.body].filter(Boolean).join(" — "),
        href: announcement.link_url,
      }))
      .filter((announcement) => announcement.text.length > 0);
  } catch (error) {
    if (isExpectedStaticThrownError(error)) return [];
    console.error("[home-data] announcements query failed.", error);
    throw error;
  }
}

export const getHomeAnnouncements = unstable_cache(
  getHomeAnnouncementsInternal,
  ["home-announcements"],
  {
    tags: [CACHE_TAGS.announcements, CACHE_TAGS.home],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  },
);
