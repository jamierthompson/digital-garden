import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

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
    // Headroom over Vitest's 5s default. The suite has genuinely compute-heavy tests — the
    // engine's dense-grid property checks and the Palette Studio's full-component renders
    // (each runs real engine derivation) — that clear 5s comfortably in isolation but, under
    // the parallel load of the whole suite on an oversubscribed machine, can starve past it
    // and time out spuriously. A higher ceiling doesn't hide a hang: a truly stuck test still
    // fails here. Inherited by both projects via `extends: true`.
    testTimeout: 20000,
    // Agent-team worktrees live in-root at .claude/worktrees/<slug>/ (each a full repo
    // checkout with its own tests, possibly mid-edit) — without this exclude the root
    // run globs every worktree's copy and a teammate's in-progress red test fails the
    // main gate. Not in Vitest's defaults, so excluded explicitly; inherited by both
    // projects via `extends: true`.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
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
          // Scoped to the engine packages — the dual-env half of the isomorphism guard. No
          // setupFiles: the engine suites need no jsdom matchers. Each engine is its own
          // workspace package but runs from root so both env halves stay in one place.
          include: [
            "packages/oklch/**/*.test.ts",
            "packages/type/**/*.test.ts",
          ],
        },
      },
    ],
  },
});
