import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Movement.log",
    short_name: "Movement.log",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#131316",
    theme_color: "#131316",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
