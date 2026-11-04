import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["../../tests/web/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "next/navigation": path.resolve(__dirname, "node_modules/next/navigation.js"),
      "@bod/api-client": path.resolve(__dirname, "../../packages/api-client/src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "@tanstack/react-query": path.resolve(__dirname, "node_modules/@tanstack/react-query"),
      "@testing-library/react": path.resolve(__dirname, "node_modules/@testing-library/react"),
    },
  },
});
