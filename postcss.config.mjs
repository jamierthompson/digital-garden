// A custom PostCSS config COMPLETELY REPLACES Next's built-in one, so the two default
// plugins are re-declared here verbatim (defaults documented in
// node_modules/next/dist/docs/02-pages/02-guides/post-css.md — flexbugs fixes +
// preset-env at stage 3 with custom-properties off). The additions on top:
//
// - `@csstools/postcss-global-data` injects the breakpoint tokens
//   (src/styles/breakpoints.css) into every compiled sheet, so CSS Modules can use them
//   without importing the definitions file.
// - `custom-media-queries: true` makes preset-env substitute `@media (--sm-up)` et al.
//   with their literal queries at build time — breakpoints can't be runtime custom
//   properties (invalid in @media conditions; see docs/architecture.md).
const config = {
  plugins: {
    "@csstools/postcss-global-data": {
      files: ["./src/styles/breakpoints.css"],
    },
    "postcss-flexbugs-fixes": {},
    "postcss-preset-env": {
      autoprefixer: {
        flexbox: "no-2009",
      },
      stage: 3,
      features: {
        "custom-properties": false,
        "custom-media-queries": true,
      },
    },
  },
};

export default config;
