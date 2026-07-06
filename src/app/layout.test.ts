import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Source-level guards for `layout.tsx` — the shell's global-CSS import order and its font
 * mounts. Both are invariants with no runtime API to assert against (the harm shows only in
 * the bundled CSS / live browser, and `next/font` is untransformed under Vitest), so they're
 * pinned at the SOURCE. Two concerns, one subject (`layout.tsx`), one co-located suite.
 */

/**
 * Guards the load-bearing global-CSS import order in `layout.tsx` (foundation.css imported first).
 *
 * The global stylesheets (`foundation.css`, which declares
 * `@layer foundation, semantic, brand, components;`) MUST be imported before `next/font` and the
 * component imports. Turbopack anchors the route's first emitted stylesheet to whatever
 * is imported first; if a `next/font`/component-module chunk loads first, the browser
 * registers `@layer components` as the lowest cascade layer and the foundation reset
 * out-ranks every component rule — the cascade inversion that zeroes component padding/margin.
 *
 * This is a SOURCE-ORDER invariant with no runtime API to assert against (the harm only
 * shows in the bundled CSS / live browser), so we pin it at the source: the foundation/
 * globals imports must appear textually before the `next/font` import. If someone reorders
 * the imports — or enables an import-sorter that does — this fails loudly in the gate
 * rather than silently reintroducing the inversion.
 */
describe("layout.tsx global-CSS import order", () => {
  // Resolve from the repo root (vitest's cwd) — jsdom gives `import.meta.url` an
  // http: scheme, so a file-URL resolution can't be used here.
  const source = readFileSync(
    resolve(process.cwd(), "src/app/layout.tsx"),
    "utf8",
  );

  const indexOfImport = (needle: string): number => {
    const idx = source.indexOf(needle);
    expect(idx, `expected layout.tsx to import ${needle}`).toBeGreaterThan(-1);
    return idx;
  };

  const nextFont = indexOfImport('from "next/font/google"');

  it("imports foundation.css before next/font", () => {
    expect(indexOfImport('import "../styles/foundation.css"')).toBeLessThan(
      nextFont,
    );
  });

  it("imports globals.css before next/font", () => {
    expect(indexOfImport('import "./globals.css"')).toBeLessThan(nextFont);
  });

  it("imports the global sheets before every component import", () => {
    const foundation = indexOfImport('import "../styles/foundation.css"');
    // The first aliased component/module import in the file.
    const firstComponent = indexOfImport('from "@/components/');
    expect(foundation).toBeLessThan(firstComponent);
  });

  it("makes foundation.css the first side-effect import — nothing may precede it", () => {
    // A side-effect import (`import "x"`, no bindings) emits a chunk; the FIRST one
    // anchors Turbopack's first emitted stylesheet. The named checks above only guard
    // the imports they mention, so a future side-effect import on ANY other path (e.g.
    // `import "@/sanity/lib/queries"`) could slip above foundation.css and reinvert the
    // cascade without tripping them. Pin the first bare import explicitly. (Type-only
    // and binding imports are erased / don't emit a leading CSS chunk, so they're fine.)
    const firstSideEffect = source.match(/^import\s+["']([^"']+)["'];?\s*$/m);
    expect(
      firstSideEffect?.[1],
      "expected a side-effect import in layout.tsx",
    ).toBe("../styles/foundation.css");
  });
});

/**
 * Guards the shell's font mounts in `layout.tsx` after the #38 preload trim.
 *
 * Two silent-failure modes this slice can regress into, neither of which the type
 * checker or a rendered-DOM test catches (the `<html>` className is a template string
 * and `next/font` is untransformed under Vitest):
 *
 *  1. **A dangling `--font-geist-sans`.** Geist Sans was removed because nothing read
 *     `var(--font-geist-sans)`; its `preload: true` was pure waste on the LCP path.
 *     Re-adding the loader (or re-mounting its variable) reintroduces a preloaded face
 *     that no surface consumes. Pin that it stays gone.
 *  2. **A dropped Geist Mono mount.** `--font-geist-mono` is the entry scope's shell-font
 *     FALLBACK (`scopeSeed.ts` → `SHELL_MONO_FACE`, guarded by `scopeSeed.test.ts`). That
 *     fallback only resolves because `geistMono.variable` is mounted on `<html>` here. If a
 *     future edit drops the mount, `var(--font-geist-mono)` resolves to nothing and every
 *     unresolved-`fontKey` slot silently loses its font — a regression no unit test in the
 *     scope module can see, because it asserts the variable NAME, not that it's in scope.
 */
describe("layout.tsx shell font mounts (#38 preload trim)", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/layout.tsx"),
    "utf8",
  );

  // The `<html className={...}>` template — the single place faces enter the shell's scope.
  const htmlClassName = source.match(/className=\{`([^`]*)`\}/)?.[1] ?? "";

  it("has an <html> className with mounted font variables", () => {
    expect(htmlClassName, "expected a className template on <html>").not.toBe(
      "",
    );
  });

  it("still mounts Geist Mono (the entry-scope shell-font fallback)", () => {
    // Import + loader call survive…
    expect(source).toMatch(/import\s*\{[^}]*\bGeist_Mono\b[^}]*\}/);
    expect(source).toMatch(/Geist_Mono\(/);
    // …and the resulting `.variable` is actually in the <html> scope.
    expect(htmlClassName).toContain("geistMono.variable");
  });

  it("mounts the three journal editorial faces (body, display, mono)", () => {
    // Source Serif 4 → `--font-face` (body); a shell-only loader like Geist Mono.
    expect(source).toMatch(/import\s*\{[^}]*\bSource_Serif_4\b[^}]*\}/);
    expect(source).toMatch(/Source_Serif_4\(/);
    expect(htmlClassName).toContain("sourceSerif.variable");
    // Space Grotesk → `--font-display` and JetBrains Mono → `--font-mono` are reused from the
    // per-entry roster (not duplicate loaders), so they mount via FONT_FACES.
    expect(htmlClassName).toContain('FONT_FACES["space-grotesk"].variable');
    expect(htmlClassName).toContain('FONT_FACES["jetbrains-mono"].variable');
  });

  it("keeps Source Serif 4 preloadless (matches the shell's no-static-preload posture)", () => {
    const serifCall =
      source.match(/Source_Serif_4\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
    expect(
      serifCall,
      "expected a Source_Serif_4({...}) options object",
    ).not.toBe("");
    expect(serifCall).toMatch(/preload:\s*false/);
    expect(serifCall).not.toMatch(/preload:\s*true/);
  });

  it("keeps Geist Mono preloadless (below the fold; preload wastes the LCP path)", () => {
    // The `Geist_Mono({...})` options object must carry `preload: false`. Flipping it back
    // to `true` (the next/font default) re-adds a below-fold preload the policy forbids.
    const monoCall = source.match(/Geist_Mono\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
    expect(monoCall, "expected a Geist_Mono({...}) options object").not.toBe(
      "",
    );
    expect(monoCall).toMatch(/preload:\s*false/);
    expect(monoCall).not.toMatch(/preload:\s*true/);
  });

  it("fully removes Geist Sans — no loader, no const, no mounted variable", () => {
    // No `Geist` sans loader imported (must not match the `Geist_Mono` import).
    expect(source).not.toMatch(/import\s*\{[^}]*\bGeist\b(?!_Mono)[^}]*\}/);
    expect(source).not.toMatch(/\bGeist\(/); // no `Geist({...})` loader call
    expect(source).not.toContain("geistSans");
    // Nothing MOUNTS `--font-geist-sans` (a comment referencing the name is fine, so we
    // assert on the live <html> scope, not the whole file).
    expect(htmlClassName).not.toContain("geistSans");
    expect(htmlClassName).not.toContain("--font-geist-sans");
  });
});
