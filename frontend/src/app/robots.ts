import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants/app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything behind the sign-in is private by nature.
      disallow: ["/dashboard/", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
