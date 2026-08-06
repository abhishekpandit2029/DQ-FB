import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants/app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Only the publicly reachable routes — the diary itself is private.
  return [
    { url: SITE_URL, lastModified, changeFrequency: "monthly", priority: 1 },
    {
      url: `${SITE_URL}/auth/login`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/auth/signup`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.8,
    },
  ];
}
