import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the load-bearing import order in `layout.tsx` [D27, D12].
 *
 * The global stylesheets (`foundation.css`, which declares
 * `@layer foundation, brand, project;`) MUST be imported before `next/font` and the
 * component imports. Turbopack anchors the route's first emitted stylesheet to whatever
 * is imported first; if a `next/font`/component-module chunk loads first, the browser
 * registers `@layer project` as the lowest cascade layer and the foundation reset
 * out-ranks every project rule — the cascade inversion that zeroes project padding/margin.
 *
 * This is a SOURCE-ORDER invariant with no runtime API to assert against (the harm only
 * shows in the bundled CSS / live browser), so we pin it at the source: the foundation/
 * globals imports must appear textually before the `next/font` import. If someone reorders
 * the imports — or enables an import-sorter that does — this fails loudly in the gate
 * rather than silently reintroducing the inversion.
 */
describe("layout.tsx global-CSS import order [D27, D12]", () => {
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
    expect(indexOfImport('import "./foundation.css"')).toBeLessThan(nextFont);
  });

  it("imports globals.css before next/font", () => {
    expect(indexOfImport('import "./globals.css"')).toBeLessThan(nextFont);
  });

  it("imports the global sheets before every component import", () => {
    const foundation = indexOfImport('import "./foundation.css"');
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
    ).toBe("./foundation.css");
  });
});
