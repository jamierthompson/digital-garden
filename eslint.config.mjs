import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import prettier from "eslint-config-prettier";

// Globals forbidden inside the OKLCH engine so it stays isomorphic — no DOM, no
// Node runtime. Framework imports (next/react) are caught by boundaries/external;
// these catch ambient global usage that imports can't [D14].
const NON_ISOMORPHIC_GLOBALS = [
  "window",
  "document",
  "navigator",
  "location",
  "localStorage",
  "sessionStorage",
  "history",
  "process",
  "Buffer",
  "__dirname",
  "__filename",
  "global",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Architectural import boundaries (stood up empty — they guard directories that
  // don't exist yet so they can't rot once code arrives).
  {
    files: ["src/**/*.{js,jsx,ts,tsx,mts,cts}"],
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["src/**/*"],
      // First match wins, so specific patterns precede the shared catch-all.
      // mode: "file" matches the full file path (folder mode compares the
      // directory, which makes a fixed-folder glob like the oklch one miss).
      "boundaries/elements": [
        { type: "app", mode: "file", pattern: "src/app/**/*" },
        { type: "oklch", mode: "file", pattern: "src/lib/oklch/**/*" },
        {
          type: "project",
          mode: "file",
          pattern: "src/projects/*/**/*",
          capture: ["slug"],
        },
        { type: "shared", mode: "file", pattern: "src/**/*" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          checkAllOrigins: true,
          rules: [
            {
              from: { type: "project" },
              disallow: {
                to: {
                  type: "project",
                  captured: { slug: "!{{from.captured.slug}}" },
                },
              },
              message:
                "A project module cannot import another project — lift shared code into a shared module.",
            },
            {
              from: { type: "shared" },
              disallow: { to: { type: "project" } },
              message:
                "Shared modules cannot import project code — dependencies point from projects to shared, never back.",
            },
            {
              from: { type: "oklch" },
              disallow: { to: { type: ["app", "project", "shared"] } },
              message:
                "The OKLCH engine must stay self-contained and isomorphic [D14].",
            },
            {
              from: { type: "oklch" },
              disallow: {
                to: { origin: ["external", "core"] },
                dependency: { module: ["next", "react", "react-dom"] },
              },
              message:
                "The OKLCH engine must stay isomorphic — no next/react/react-dom [D14].",
            },
          ],
        },
      ],
    },
  },
  // The OKLCH engine may not touch DOM or Node runtime globals.
  {
    files: ["src/lib/oklch/**/*.{js,jsx,ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-globals": ["error", ...NON_ISOMORPHIC_GLOBALS],
    },
  },
  // Must come last: turns off any ESLint rules that would conflict with Prettier.
  prettier,
]);

export default eslintConfig;
