import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the seeded demo database with every server function (Vercel).
  outputFileTracingIncludes: { "/**/*": ["./prisma/dev.db"] },
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
