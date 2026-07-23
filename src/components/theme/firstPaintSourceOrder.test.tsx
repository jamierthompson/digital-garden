import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { resolveThemeDeclarations } from "@/lib/theme";

import PageTheme from "./PageTheme";

/**
 * REGRESSION PIN for #187 — the public FOUC.
 *
 * The bug: the page seed was applied by an inline `<script>` rendered inside the page BODY,
 * which is emitted AFTER the shared root-layout chrome (`SiteNav`) in source order. First
 * paint used the neutral `:root` fallback, then the script re-themed → a real flash. Every
 * prior check measured `getComputedStyle` post-hydration, which always shows the settled
 * theme, so it missed the bug entirely.
 *
 * The invariant that MUST hold: the page's theme lands in `<head>` — BEFORE the body chrome —
 * in the SERVER-RENDERED source order, with no script. These tests assert exactly that, at the
 * only layer that catches it: raw markup byte order, never post-hydration computed style.
 *
 * `renderToStaticMarkup` reproduces React 19's `<style href precedence>` head-hoist (verified
 * against the real production `.next/server/app/**.html` — see the built-artifact block below),
 * so the composition test runs in the normal gate without a build; the built-artifact block
 * additionally pins the real emitted HTML whenever a production build is present.
 */

const SEED_A = "#c2410c"; // warm
const SEED_B = "#1d4ed8"; // cool — must derive a visibly different accent

const accentOf = (seed: unknown): string =>
  Object.fromEntries(resolveThemeDeclarations(seed))["--accent"];

/** Mirrors `layout.tsx`: chrome (`SiteNav` → a `<header>`) renders BEFORE `{children}`, where
 *  the page mounts `<PageTheme>`. So the theme is authored AFTER the chrome in body source
 *  order — the exact shape the FOUC exploited. */
function renderDocument(seed: unknown): string {
  return renderToStaticMarkup(
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-head-element -- asserting raw SSR head/body byte order requires the literal element, not next/head */}
      <head>
        <title>t</title>
      </head>
      <body>
        <header data-chrome>site nav</header>
        <PageTheme seed={seed} />
      </body>
    </html>,
  );
}

describe("first-paint theme source order (#187 FOUC regression)", () => {
  it("hoists the theme :root <style> into <head>, before the body chrome", () => {
    const html = renderDocument(SEED_A);

    const stylePos = html.search(/<style[^>]*page-theme[^>]*>:root\{/);
    const headEnd = html.indexOf("</head>");
    const chromePos = html.indexOf("data-chrome");

    expect(stylePos, "theme <style> must exist").toBeGreaterThan(-1);
    // In <head> …
    expect(stylePos).toBeLessThan(headEnd);
    // … and therefore before the chrome, which lives in <body>.
    expect(stylePos).toBeLessThan(chromePos);
    // Sanity: the chrome really is authored after the head (guards a malformed fixture).
    expect(chromePos).toBeGreaterThan(headEnd);
  });

  it("bakes the seed's real accent into that <style> (no script, value present at rest)", () => {
    const html = renderDocument(SEED_A);
    expect(html).toContain(":root{");
    expect(html).toContain(accentOf(SEED_A));
  });

  it("emits NO inline theme script — the removed FOUC mechanism stays gone", () => {
    const html = renderDocument(SEED_A);
    // The old mechanism imperatively set custom properties from a body <script>.
    expect(html).not.toMatch(/setProperty/);
    expect(html).not.toMatch(/<script[^>]*>[^<]*--accent/);
  });

  it("two different seeds bake two different accents (per-page seed, not a shared constant)", () => {
    expect(accentOf(SEED_A)).not.toBe(accentOf(SEED_B));
    expect(renderDocument(SEED_A)).toContain(accentOf(SEED_A));
    expect(renderDocument(SEED_B)).toContain(accentOf(SEED_B));
  });
});

/**
 * Belt-and-suspenders: when a production build is present, assert the invariant on the REAL
 * emitted HTML for every prerendered route. Skips (does not fail) when `.next` is absent, so
 * the normal `pnpm test` gate — which runs before `pnpm build` — stays green; a full local
 * gate or a post-build CI step exercises it against the true artifact.
 */
const PRERENDER_DIR = join(process.cwd(), ".next", "server", "app");
const ROUTE_FILES = [
  "index.html", // /
  "about.html",
  "system.html",
  "now.html",
  "browse.html",
];

describe("first-paint theme source order — built production HTML", () => {
  const haveBuild = existsSync(PRERENDER_DIR);

  it.skipIf(!haveBuild)(
    "every prerendered route has the theme <style> in <head> before the chrome",
    () => {
      for (const name of ROUTE_FILES) {
        const file = join(PRERENDER_DIR, name);
        expect(existsSync(file), `${name} should be prerendered`).toBe(true);
        const html = readFileSync(file, "utf8");

        const stylePos = html.search(/<style[^>]*page-theme[^>]*>:root\{/);
        const headEnd = html.indexOf("</head>");
        const chrome = [html.indexOf("<header"), html.indexOf("<nav")].filter(
          (i) => i !== -1,
        );
        const chromePos = chrome.length ? Math.min(...chrome) : Infinity;

        expect(stylePos, `${name}: theme <style> present`).toBeGreaterThan(-1);
        expect(stylePos, `${name}: style in <head>`).toBeLessThan(headEnd);
        expect(stylePos, `${name}: style before chrome`).toBeLessThan(
          chromePos,
        );
        expect(html, `${name}: no inline theme script`).not.toMatch(
          /documentElement\.style\.setProperty/,
        );
      }
    },
  );

  it.skipIf(!haveBuild)(
    "distinct routes bake distinct seeds (no shared/leaked theme block)",
    () => {
      const accents = new Set<string>();
      for (const name of ROUTE_FILES) {
        const html = readFileSync(join(PRERENDER_DIR, name), "utf8");
        const m = html.match(
          /<style[^>]*page-theme[^>]*>:root\{[^<]*?--accent:(light-dark\([^;}]*\))/,
        );
        expect(m, `${name}: --accent baked in theme block`).not.toBeNull();
        accents.add(m![1]);
      }
      expect(accents.size, "each route should bake its own accent").toBe(
        ROUTE_FILES.length,
      );
    },
  );
});

/**
 * Injection surface: the theme block is authored via `dangerouslySetInnerHTML`. Prove the
 * engine pipeline (which a future live "play" path would also feed) can never emit a value or
 * property carrying a `<style>`-breakout or CSS-block-breakout character, for ANY seed —
 * `cssSafe` in `ThemeStyle` is then a second line of defense, not the only one.
 */
describe("theme declarations carry no injection characters (any seed)", () => {
  const HOSTILE_SEEDS: unknown[] = [
    "</style><script>alert(1)</script>",
    "#c2410c}</style><script>x</script>{",
    "}}}",
    "<img src=x onerror=alert(1)>",
    { toString: () => "</style>" },
    ["</style>"],
    12345,
    "",
  ];

  for (const seed of HOSTILE_SEEDS) {
    it(`resolves ${JSON.stringify(seed)} to declarations free of < > } ; and </style`, () => {
      const decls = resolveThemeDeclarations(seed);
      expect(decls.length).toBeGreaterThan(0);
      for (const [property, value] of decls) {
        for (const token of ["<", ">", "}", ";", "</style"]) {
          expect(property, `property "${property}"`).not.toContain(token);
          expect(value, `value "${value}"`).not.toContain(token);
        }
      }
    });
  }
});
