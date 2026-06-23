import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The OKLCH engine is isomorphic [D14]: its suite runs under BOTH `node` and `jsdom`
// to prove identical behavior server- and client-side. `test.projects` runs the SAME
// glob in both envs with no duplication (`workspace` is deprecated since Vitest 3.2).
// Engine tests use relative imports, so they need no @/* alias; the jsdom project keeps
// `resolve.tsconfigPaths` for the app tests that import via `@/*`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./tests/setup.ts"],
          // jsdom is intentionally broad — it runs EVERYTHING, including the engine
          // glob (which also runs under node below). If a node-ONLY test is ever added
          // outside the engine, exclude it here so it doesn't run in the wrong env.
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          globals: true,
          // Scoped to the engine ONLY — the dual-env half of the isomorphism guard.
          // No jsdom matcher setup (no setupFiles): the engine suite needs none.
          include: ["src/lib/oklch/**/*.test.ts"],
        },
      },
    ],
  },
});
