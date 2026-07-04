import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prerendered shell + streamed dynamic holes; opt into caching via `use cache`.
  cacheComponents: true,
  // The OKLCH engine is a TypeScript-source workspace package — Next transpiles
  // it as part of the app bundle (it ships no prebuilt JS).
  transpilePackages: ["@garden/oklch"],
  experimental: {
    // LOAD-BEARING for the scheme toggle (#133) and the whole `light-dark()` token model.
    // Turbopack's Lightning CSS, at the default browser targets, POLYFILLS `light-dark()`
    // into `var(--lightningcss-light) var(--lightningcss-dark)` pairs toggled by
    // `@media (prefers-color-scheme)` — i.e. keyed on the OS, IGNORING the `color-scheme`
    // property. That silently defeats the architecture's premise (set `color-scheme` on
    // :root ⇒ every token flips): a forced override only ever agreed with the OS, so it
    // could never flip against it. Excluding `light-dark` from transpilation emits the
    // NATIVE function, which DOES follow the `color-scheme` property (live + flash-free),
    // at the cost of dropping the polyfill for pre-Baseline-2024 browsers without native
    // `light-dark()`. Documented knob (Next 16.2+, applies to Turbopack): useLightningcss.md.
    lightningCssFeatures: {
      exclude: ["light-dark"],
    },
  },
};

export default nextConfig;
