import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prerendered shell + streamed dynamic holes; opt into caching via `use cache`.
  cacheComponents: true,
  // The OKLCH engine is a TypeScript-source workspace package — Next transpiles
  // it as part of the app bundle (it ships no prebuilt JS).
  transpilePackages: ["@garden/oklch"],
};

export default nextConfig;
