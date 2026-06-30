import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The OKLCH engine is isomorphic: its suite runs under BOTH `node` and `jsdom`
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
          // jsdom is intentionally broad — it runs everything, including the engine glob
          // (which also runs under node below). A node-only test added outside the engine
          // must be excluded here so it doesn't run in the wrong env.
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          globals: true,
          // Scoped to the engine — the dual-env half of the isomorphism guard. No
          // setupFiles: the engine suite needs no jsdom matchers. The engine is its own
          // workspace package but runs from root so both env halves stay in one place.
          include: ["packages/oklch/**/*.test.ts"],
        },
      },
    ],
  },
});
