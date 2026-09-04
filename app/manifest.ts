import type { MetadataRoute } from "next";

/**
 * Installability matters more here than any meta tag above it.
 *
 * Workspace is a pinned-tab product — the whole premise is a board people leave
 * open all day and glance at. Installed, it gets its own window, its own dock
 * icon and no address bar, which is the form the premise actually wants.
 *
 * start_url is /board rather than /, because someone who installed this is
 * signed in and / only exists to redirect. Middleware still sends them to
 * /login if the session has lapsed.
 *
 * Colours are hex twice over: the manifest predates oklch by a decade, and
 * background_color is painted by the OS before any CSS has loaded, so it has to
 * match --canvas or the splash flashes a different white than the app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Workspace",
    short_name: "Workspace",
    description:
      "An ambient status board that replaces the daily standup. See what your team is working on without asking.",
    start_url: "/board",
    display: "standalone",
    background_color: "#f8f6fd",
    theme_color: "#f8f6fd",
    icons: [
      // Unhashed, from public/. The app/icon.* convention files get a content
      // hash in their URL, which is right for a <link> Next writes itself and
      // wrong for a manifest entry that has to stay stable across deploys.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
