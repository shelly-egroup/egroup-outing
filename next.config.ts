import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/stores/*/reviews": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};
export default config;
