import type { MetadataRoute } from "next";

const SITE_URL = "https://chicano-auto-services.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/espace-client", "/production", "/technicien", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
