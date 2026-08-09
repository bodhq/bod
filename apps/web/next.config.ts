import "./src/core/env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bod/api-client"],
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
