// Web app manifest (/manifest.webmanifest): lets phones install the store and is
// what the Android app (a Trusted Web Activity) is built from.
export default function manifest() {
  return {
    name: "Al Ammar Store",
    short_name: "Al Ammar",
    description:
      "Everyday essentials delivered across Pakistan. Pay cash on delivery.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf9f6",
    theme_color: "#174f42",
    categories: ["shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
