import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // www.catapacks.xyz → catapacks.xyz (Vercel domain settings can do the same)
    return [{ source: "/:path*", has: [{ type: "host", value: "www.catapacks.xyz" }], destination: "https://catapacks.xyz/:path*", permanent: true }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
