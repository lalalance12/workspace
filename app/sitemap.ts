import type { MetadataRoute } from "next";

import { siteURL } from "@/lib/site-url";

/**
 * One entry, and it should stay that way.
 *
 * /login and /signup are reachable without a session but they are forms, not
 * content — listing them would ask search engines to rank a sign-in box. Every
 * other route is behind auth and says noindex. So the sitemap says what is
 * true: there is one public page.
 *
 * If a second one ever appears — pricing, a changelog — it goes here, and its
 * page gets `robots: { index: true }` to opt out of the layout's default. The
 * two have to move together or the sitemap starts advertising pages that
 * refuse to be indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", siteURL()).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
