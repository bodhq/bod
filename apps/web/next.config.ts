import type { NextConfig } from "next";

import { env } from "./src/core/env";

const nextConfig: NextConfig = {
  transpilePackages: ["@bod/api-client"],
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${env.API_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
