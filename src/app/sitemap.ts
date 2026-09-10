import type { MetadataRoute } from "next";

const SITE_URL = "https://chicano-auto-services.vercel.app";

// Sitemap volontairement limité aux routes publiques réellement indexables —
// les routes espace-client/production/technicien exigent une authentification
// et n'ont pas leur place dans un sitemap public.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/urgence`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/inscription`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/connexion`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
