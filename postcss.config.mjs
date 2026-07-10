// A custom PostCSS config COMPLETELY REPLACES Next's built-in one, so the two default
// plugins are re-declared here verbatim (defaults documented in
// node_modules/next/dist/docs/02-pages/02-guides/post-css.md — flexbugs fixes +
// preset-env at stage 3 with custom-properties off).
const config = {
  plugins: {
    "postcss-flexbugs-fixes": {},
    "postcss-preset-env": {
      autoprefixer: {
        flexbox: "no-2009",
      },
      stage: 3,
      features: {
        "custom-properties": false,
      },
    },
  },
};

export default config;
