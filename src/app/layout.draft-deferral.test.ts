import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the load-bearing `<Suspense>` boundary in `layout.tsx` that makes Draft Mode
 * preview of the shell legal under Cache Components [D11, D16, D27].
 *
 * Under Cache Components, Draft Mode bypasses `use cache`: `sanityFetch` re-executes
 * uncached on every request (use-cache.md §"Draft Mode"), so the shell `siteSettings` read
 * becomes request-time data. Cache Components forbids uncached data accessed during prerender
 * unless it sits behind `<Suspense>` (caching.md "blocking-route"). The shell reads
 * `siteSettings` in TWO places — `generateMetadata` and the body's `ShellTheme` — and the
 * body `<Suspense>` is what lets BOTH defer: once the body subtree defers under Draft Mode,
 * the route is in the sanctioned "other parts also defer → metadata streams with them" branch
 * (generate-metadata.md §"With Cache Components"), so `generateMetadata` no longer trips its
 * own error. Remove the boundary, or add a third un-Suspense'd `siteSettings` read, and the
 * draft path throws `Uncached data … outside of <Suspense>` again.
 *
 * That failure only manifests at RUNTIME under the draft cookie — `pnpm build` prerenders the
 * published path and stays green, and an async-RSC draft render is not jsdom-testable [D25].
 * So the runtime proof lives on the pre-merge QA bar (a real draft edit through Preview). These
 * are the cheap CI tripwires for the SOURCE invariants the runtime proof depends on.
 *
 * If a future Next narrows the "other parts defer → metadata streams" rule, the recorded
 * escalation is `'use cache'` on `generateMetadata` (see docs/decisions.md) — at which point
 * this test's read-count expectation is updated alongside.
 */
describe("layout.tsx draft-mode deferral boundary [D11, D16]", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/layout.tsx"),
    "utf8",
  );

  // Strip comments before matching JSX. The load-bearing comment in layout.tsx names `<Suspense>`
  // and `ShellTheme` in prose, so asserting against the RAW source false-greens (verified by QA:
  // deleting the real boundary but keeping the comment kept the old test green). Match `code`.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "") // block + JSX `{/* … */}` comments
    .replace(/\/\/[^\n]*/g, ""); // line comments

  it("wraps the shell subtree in a real <Suspense> JSX boundary (not just a comment)", () => {
    expect(
      /<Suspense[\s\n/>]/.test(code),
      "expected a real <Suspense> JSX element — it licenses the Draft-Mode deferral of the " +
        "shell siteSettings read at BOTH the body and generateMetadata",
    ).toBe(true);
  });

  it("reads SITE_SETTINGS_QUERY exactly twice (generateMetadata + ShellTheme)", () => {
    // A THIRD read risks an un-Suspense'd request-time access that re-breaks the draft path; a
    // MISSING read (count 1) means the body deferral — which rescues generateMetadata — was removed.
    const reads = code.match(/sanityFetch\(SITE_SETTINGS_QUERY\)/g) ?? [];
    expect(
      reads.length,
      "expected exactly two sanityFetch(SITE_SETTINGS_QUERY) reads; a third must live " +
        "inside ShellTheme/the Suspense boundary, and neither existing read may be removed",
    ).toBe(2);
  });

  it("keeps the body read inside an async ShellTheme (not awaited at the layout root)", () => {
    expect(
      /async function ShellTheme\b/.test(code),
      "expected the body siteSettings read to live in an async ShellTheme component",
    ).toBe(true);
  });

  it("mounts <ProjectScope> exactly once — a second mount collides on the brand <style> href", () => {
    // The real ShellTheme and any themed Suspense fallback would BOTH emit
    // `<style href="project-theme-garden">`; React 19 de-dupes hoisted styles by href keeping the
    // FIRST committed (the fallback), silently dropping the real/edited brand on the published
    // static build AND draft Preview (the Item C regression QA caught). Exactly one mount keeps the
    // real brand the sole emitter; the Suspense fallback (ShellThemeFallback) stays ProjectScope-free.
    const mounts = code.match(/<ProjectScope\b/g) ?? [];
    expect(
      mounts.length,
      "expected exactly one <ProjectScope> mount in layout.tsx — the fallback must not render one",
    ).toBe(1);
  });
});
