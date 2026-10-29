import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep tracing inside this repo when a parent directory has its own lockfile.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
