import type { NextConfig } from "next";

const config: NextConfig = {
  // Native/TCP drivers must stay out of the bundler.
  serverExternalPackages: ["mongodb", "ioredis"],
};

export default config;
