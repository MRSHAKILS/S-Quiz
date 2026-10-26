import type { NextConfig } from "next";

const config: NextConfig = {
  // Lets the e2e dev server keep its artifacts apart from `next build` output.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Native/TCP drivers must stay out of the bundler.
  serverExternalPackages: ["mongodb", "ioredis"],
};

export default config;
