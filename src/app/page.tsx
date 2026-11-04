import HomeExperience from "@/components/home/HomeExperience";
import { getHomeAnnouncements, getHomeCategories } from "@/lib/home-data";
import { getMenuCategories } from "@/lib/menu-data";
import { getSaleData } from "@/lib/sale-data";
import { getStoreDetails } from "@/lib/store-details";

export default async function Home() {
  const [categories, announcements, menuCategories, details, sale] = await Promise.all([
    getHomeCategories(),
    getHomeAnnouncements(),
    getMenuCategories(),
    getStoreDetails(),
    getSaleData(),
  ]);

  return (
    <HomeExperience
      categories={categories}
      saleSlide={
        sale.hasSaleProducts && sale.desktopImageUrl
          ? {
              imageUrl: sale.desktopImageUrl,
              mobileImageUrl: sale.mobileImageUrl,
            }
          : null
      }
      saleVisible={sale.hasSaleProducts}
      announcements={announcements}
      menuCategories={menuCategories}
      details={details}
    />
  );
}