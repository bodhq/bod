import "./src/env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bod/api-client"],
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
