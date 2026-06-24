import "./src/env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bod/api-client"],
  output: "standalone",
};

export default nextConfig;
