import HomeExperience from "@/components/home/HomeExperience";
import { getHomeAnnouncements, getHomeCategories } from "@/lib/home-data";
import { getMenuCategories } from "@/lib/menu-data";
import { getStoreDetails } from "@/lib/store-details";

export default async function Home() {
  const [categories, announcements, menuCategories, details] = await Promise.all([
    getHomeCategories(),
    getHomeAnnouncements(),
    getMenuCategories(),
    getStoreDetails(),
  ]);

  return (
    <HomeExperience
      categories={categories}
      announcements={announcements}
      menuCategories={menuCategories}
      details={details}
    />
  );
}