import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@airspace/shared", "@airspace/sas"],
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
