import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"]
  },
  outputFileTracingRoot: process.cwd()
};

export default nextConfig;

