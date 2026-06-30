import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the load-bearing `<Suspense>` boundary in `layout.tsx` that defers the shell's async
 * body read under Draft Mode + Cache Components.
 *
 * `ShellTheme` awaits `sanityFetch(SITE_SETTINGS_QUERY)`. Under Cache Components, Draft Mode
 * bypasses `use cache`, so that read re-executes uncached per request (use-cache.md) — request-time data in the body. Cache Components forbids uncached data accessed during
 * prerender unless it sits behind `<Suspense>` (caching.md "blocking-route"); the body
 * `<Suspense>` is what lets the async `ShellTheme` read defer. Remove the boundary and the body
 * read trips `Uncached data … outside of <Suspense>` — verified: it surfaces live in `next dev`
 * (a production build prerendered the cached read, so prod tolerates it, but the shape is wrong).
 *
 * NOTE: `generateMetadata` ALSO reads `siteSettings`, but it does NOT depend on this boundary —
 * its read is `use cache` (cached at build, dynamic under draft) and is independently legal;
 * "removing the boundary does NOT make metadata throw" was proven by spike Control C — but only with a
 * SYNCHRONOUS body. CAVEAT: removing the boundary while `ShellTheme` is still async makes `next dev` log
 * a blocking-route error whose stack frame points at `generateMetadata` (the un-deferred async body
 * makes the whole route blocking; metadata is just where it's reported — not metadata failing alone).
 * The "exactly twice" count below just pins the current two call sites; it is a structural tripwire,
 * NOT evidence of a metadata-licensing relationship.
 *
 * The body-read failure only manifests at RUNTIME (in `next dev`, or under the draft cookie) —
 * `pnpm build` prerenders the published path and stays green, and an async-RSC draft render is
 * not jsdom-testable. These are the cheap CI tripwires for the SOURCE invariants.
 */
describe("layout.tsx draft-mode deferral boundary", () => {
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
      "expected a real <Suspense> JSX element — it defers the async ShellTheme body " +
        "siteSettings read under Draft Mode (generateMetadata's read is independently legal via use cache)",
    ).toBe(true);
  });

  it("reads SITE_SETTINGS_QUERY exactly twice (generateMetadata + ShellTheme)", () => {
    // A THIRD read risks an un-Suspense'd request-time access that re-breaks the body draft path; a
    // MISSING read (count 1) means the async body read in ShellTheme was removed.
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
