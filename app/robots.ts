import type { MetadataRoute } from "next";

import { siteURL } from "@/lib/site-url";

/**
 * Permissive, which looks like the wrong answer for a private app and isn't.
 *
 * The exclusion is done by the `noindex` in layout.tsx. A crawler told to
 * Disallow a path never fetches it, so it never sees that tag — and a URL
 * someone pasted in a public issue can then still appear as a bare, untitled
 * result that you no longer have any mechanism to remove. Letting the crawler
 * in so it can read "noindex" is what actually keeps the app out of the index.
 *
 * /auth/ is the one real Disallow. Sign-in codes arrive there in the query
 * string; single-use and short-lived, but there is no reason to write them into
 * anyone's crawl log.
 *
 * The sitemap lists exactly one URL, because exactly one page is indexable.
 * That is not a token gesture — it is the difference between a crawler
 * inferring which page matters from a pile of redirects and being told.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/auth/",
    },
    sitemap: new URL("/sitemap.xml", siteURL()).toString(),
  };
}
