export const CACHE_TAGS = {
  categories: "categories",
  subCategories: "sub-categories",
  products: "products",
  product: (slug: string) => `product:${slug}`,
  category: (slug: string) => `category:${slug}`,
  subCategory: (categorySlug: string, subSlug: string) => `subcategory:${categorySlug}:${subSlug}`,
  announcements: "announcements",
  team: "team",
  storeDetails: "store-details",
  menu: "menu",
  home: "home",
} as const;

export const DEFAULT_PUBLIC_REVALIDATE = 300;
