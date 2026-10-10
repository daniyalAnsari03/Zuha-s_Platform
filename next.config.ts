import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
    qualities: [75, 95, 100],
    // Extra steps between the defaults (notably 1024/1440) so a full-bleed
    // `sizes="100vw"` image on a large phone resolves to a ~1440px candidate
    // instead of jumping straight to 1920px+. Smaller assets mean less to
    // download and decode, which is what keeps the homepage slider smooth.
    deviceSizes: [360, 414, 480, 640, 750, 828, 1024, 1080, 1200, 1440, 1920, 2048, 3840],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },
};

export default nextConfig;
