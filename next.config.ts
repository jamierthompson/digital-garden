import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prerendered shell + streamed dynamic holes; opt into caching via `use cache`.
  cacheComponents: true,
};

export default nextConfig;
