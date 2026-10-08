import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_TAGS, DEFAULT_PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import {
  SITE_CONTACT,
  SITE_NAME,
  SITE_SOCIAL_LINKS,
  type StoreDetails,
} from "@/lib/site-config";
import { createPublicClient } from "@/lib/supabase/public";

export type { StoreDetails };

const TABLE_COLUMNS =
  "id, store_name, contact_email, phone, address, instagram_url, facebook_url, tiktok_url, whatsapp_url";

function fallback(): StoreDetails {
  return {
    name: SITE_NAME,
    contact: { ...SITE_CONTACT },
    socials: SITE_SOCIAL_LINKS.map((link) => ({ ...link })),
  };
}

function override(value: string | null | undefined, fallbackValue: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed || fallbackValue;
}

async function getStoreDetailsInternal(): Promise<StoreDetails> {
  try {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("store_details")
      .select(TABLE_COLUMNS)
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return fallback();

    const socials = SITE_SOCIAL_LINKS.map((link) => ({
      ...link,
      href:
        link.label === "Instagram"
          ? override(data.instagram_url, link.href)
          : link.label === "Facebook"
            ? override(data.facebook_url, link.href)
            : link.label === "TikTok"
              ? override(data.tiktok_url, link.href)
              : link.label === "WhatsApp"
                ? override(data.whatsapp_url, link.href)
                : link.href,
    }));

    return {
      name: override(data.store_name, SITE_NAME),
      contact: {
        email: override(data.contact_email, SITE_CONTACT.email),
        phone: override(data.phone, SITE_CONTACT.phone),
        address: override(data.address, SITE_CONTACT.address),
      },
      socials,
    };
  } catch {
    return fallback();
  }
}

export const getStoreDetails = unstable_cache(
  getStoreDetailsInternal,
  ["store-details"],
  {
    tags: [CACHE_TAGS.storeDetails],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  },
);
