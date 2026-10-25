import type { MetadataRoute } from "next";

// Install metadata with the Jejak Jadi icons. Kept in Indonesian like the default locale; the app
// itself redirects "/" to /id or /en.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jadinya",
    short_name: "Jadinya",
    description: "Tempat maker vibe coding Indonesia memamerkan karya dan berbagi cara membuatnya.",
    start_url: "/",
    display: "browser",
    background_color: "#f7f6f2",
    theme_color: "#a44732",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
