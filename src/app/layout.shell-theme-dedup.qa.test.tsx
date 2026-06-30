import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

// next/font/google is untransformed under Vitest — mock the roster faces (same pattern as
// ProjectScope.test.tsx). The brand TOKENS come from the real @garden/oklch engine, so the
// hue assertions below are engine-driven and unaffected by this mock.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import ProjectScope from "@/components/project-scope/ProjectScope";

/**
 * QA regression suite for the **Item C draft-preview fix** (layout.tsx `<Suspense>` +
 * `ShellTheme`). Added as a regression case from adversarial QA review.
 *
 * THE DEFECT QA caught (on the real stack — `pnpm build` + a production `next start` browser
 * check, and `next dev` under the draft cookie): the original fix gave the Suspense FALLBACK its
 * own `<ProjectScope slug="garden">`. The real `ShellTheme` ALSO renders `<ProjectScope
 * slug="garden">`, so BOTH emitted `<style href="project-theme-garden">`. React 19 de-dupes
 * hoisted styles by href and keeps the FIRST committed — the fallback (rendered first during
 * prerender) — so the published static `/` and draft Preview both applied the ENGINE FALLBACK
 * palette (hue 264 / mono), never the real or draft-edited brand.
 *
 * THE FIX (author): the fallback is now `ShellThemeFallback`, which renders NO `<ProjectScope>`,
 * so only the real `ShellTheme` emits `project-theme-garden` and the real brand wins. The
 * structural guarantee that the layout keeps exactly one `<ProjectScope>` mount is pinned by
 * `layout.draft-deferral.test.ts` ("mounts <ProjectScope> exactly once"); this file documents
 * the underlying React 19 de-dup mechanism that makes a second mount dangerous.
 */
const FALLBACK_SEED = { slug: "garden", brandColor: "", fontKey: "" };
const REAL_SEED = {
  slug: "garden",
  brandColor: "oklch(0.62 0.13 150)",
  fontKey: "fraunces",
};

function gardenStyles(): string[] {
  return [
    ...document.head.querySelectorAll(
      'style[data-href="project-theme-garden"]',
    ),
  ].map((s) => s.textContent ?? "");
}

describe("shell theme — why the Suspense fallback must not render ProjectScope [Item C]", () => {
  it("two same-slug ProjectScopes collide → React 19 de-dupes hoisted styles to a single tag", () => {
    // The mechanism behind the defect: the fallback's <style> and the real ShellTheme's <style>
    // share `href="project-theme-garden"`, so React keeps only ONE — and it's the first committed
    // (the fallback). This is why ShellThemeFallback must stay ProjectScope-free; the layout-level
    // guarantee is enforced by the exactly-one-mount assertion in layout.draft-deferral.test.ts.
    render(
      <>
        <ProjectScope seed={FALLBACK_SEED}>fallback</ProjectScope>
        <ProjectScope seed={REAL_SEED}>real</ProjectScope>
      </>,
    );
    expect(gardenStyles().length).toBe(1);
  });

  it("a real <Suspense> JSX element exists in layout.tsx (not merely in a comment)", () => {
    // FALSE-GREEN guard: the load-bearing comment in layout.tsx contains the text "<Suspense>",
    // so asserting `/<Suspense\b/` against RAW source passes even if the real JSX boundary is
    // deleted (which re-introduces the original blocking-route throw under draft mode). Strip
    // comments first so this tracks the actual JSX element.
    const source = readFileSync(
      resolve(process.cwd(), "src/app/layout.tsx"),
      "utf8",
    );
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, "") // block + JSX `{/* … */}` comments
      .replace(/\/\/[^\n]*/g, ""); // line comments
    expect(
      /<Suspense[\s\n/>]/.test(withoutComments),
      "expected a real <Suspense> JSX element (comments stripped) — the draft-deferral " +
        "boundary, not just a mention of it in a comment",
    ).toBe(true);
  });
});
