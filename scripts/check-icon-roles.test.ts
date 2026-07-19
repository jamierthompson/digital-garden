import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { findIconRoleViolations } from "./check-icon-roles.mjs";

/**
 * The guard that keeps non-text graphics off the text tier (WCAG 2.2 SC 1.4.11 → 3:1, the
 * engine's `ui` tier). Its detector is pure, so it is tested on sources rather than on the repo.
 */
describe("check-icon-roles", () => {
  const lines = (css: string): number[] =>
    findIconRoleViolations(css).map((v) => v.line);

  it("FAILS an icon rule painting color from a text role", () => {
    expect(lines(`.icon { color: var(--muted-foreground); }`)).toEqual([1]);
  });

  it("ALLOWS --foreground on a graphic — the neutral ramp's own full strength", () => {
    // `--icon` and `--foreground` are both `role: neutral`; moving between them is a strength
    // change within one role, which is how a graphic expresses emphasis/hover. `muted-foreground`
    // is the one neutral that is NOT allowed: its job is secondary TEXT, and its graphic
    // counterpart is `--icon` itself.
    expect(lines(`.icon { color: var(--foreground); }`)).toEqual([]);
    expect(lines(`.icon:hover { color: var(--muted-foreground); }`)).toEqual([
      1,
    ]);
  });

  it("FAILS every text-tier role, including the per-status ones", () => {
    for (const token of [
      "--muted-foreground",
      "--accent-text",
      "--error-text",
      "--warning-text",
      "--success-text",
      "--info-text",
    ]) {
      expect(
        lines(`.icon { color: var(${token}); }`),
        `expected ${token} to be rejected`,
      ).toEqual([1]);
    }
  });

  it("FAILS a bare svg element selector and a descendant svg", () => {
    expect(lines(`svg { fill: var(--accent-text); }`)).toEqual([1]);
    expect(lines(`.mark svg { stroke: var(--muted-foreground); }`)).toEqual([
      1,
    ]);
  });

  it("catches every icon-ish part name, and compound class names", () => {
    for (const selector of [
      ".icon",
      ".mark",
      ".glyph",
      ".logo",
      ".navIcon",
      ".icon-lg",
      ".logoMark",
    ]) {
      expect(
        lines(`${selector} { color: var(--accent-text); }`),
        `expected ${selector} to be treated as a graphic`,
      ).toEqual([1]);
    }
  });

  it("PASSES the graphic ink and the fills a graphic may legitimately wear", () => {
    for (const token of [
      "--icon",
      "--accent",
      "--accent-hover",
      "--error",
      "--accent-foreground",
      "--error-foreground",
      "currentColor",
    ]) {
      expect(
        lines(`.icon { color: var(${token}); }`),
        `expected ${token} to be allowed`,
      ).toEqual([]);
    }
  });

  it("PASSES a text rule reading a text role — the guard is scoped to graphics", () => {
    expect(lines(`.meta { color: var(--muted-foreground); }`)).toEqual([]);
    expect(lines(`.title { color: var(--foreground); }`)).toEqual([]);
  });

  it("ignores non-paint properties on a graphic rule", () => {
    // A text role named in a border or a shadow on an icon wrapper is not the ink of the
    // glyph; this guard is about what PAINTS the graphic.
    expect(lines(`.icon { border-color: var(--muted-foreground); }`)).toEqual(
      [],
    );
  });

  describe("component-token indirection — the laundering hole", () => {
    it("FOLLOWS a local component token to the role it resolves to", () => {
      // `--logo-ink: var(--muted-foreground); color: var(--logo-ink)` is the same violation as
      // the inline read. Without resolution the indirection silently launders a text role onto
      // a graphic — and every module here paints through component tokens, so a guard that
      // stopped at the declaration would be near-vacuous on this codebase.
      expect(
        lines(
          `.icon { --logo-ink: var(--muted-foreground); color: var(--logo-ink); }`,
        ),
      ).toEqual([1]);
    });

    it("follows a token declared on one rule and consumed on another", () => {
      // The repo's convention declares component tokens on the component's ROOT rule and
      // consumes them in state rules — so resolution has to be module-wide, not rule-local.
      const css = [
        `.logo { --logo-ink-hover: var(--accent-text); }`,
        `.logo:hover { color: var(--logo-ink-hover); }`,
      ].join("\n");
      expect(lines(css)).toEqual([2]);
    });

    it("follows a MULTI-level chain", () => {
      const css = `.icon { --a: var(--accent-text); --b: var(--a); color: var(--b); }`;
      expect(lines(css)).toEqual([1]);
    });

    it("does not flag a declaration that merely EXISTS but is never painted", () => {
      expect(lines(`.icon { --unused: var(--muted-foreground); }`)).toEqual([]);
    });

    it("terminates on a cyclic declaration instead of hanging", () => {
      const css = `.icon { --a: var(--b); --b: var(--a); color: var(--a); }`;
      expect(() => lines(css)).not.toThrow();
      expect(lines(css)).toEqual([]);
    });

    it("passes a component token bound to the graphic ink", () => {
      expect(
        lines(`.icon { --logo-ink: var(--icon); color: var(--logo-ink); }`),
      ).toEqual([]);
    });
  });

  it("sees through comments inside a value and tolerates loose spacing", () => {
    // postcss keeps comments inside declaration values; the CSS engine treats them as
    // whitespace, so the detector must too or `var(/**/--accent-text)` walks straight past.
    expect(lines(`.icon { color: var(/**/--accent-text); }`)).toEqual([1]);
    expect(lines(`.icon { color: VAR( --accent-text ); }`)).toEqual([1]);
  });

  it("reports each violating declaration separately, with its line", () => {
    const css = [
      `.icon {`,
      `  color: var(--muted-foreground);`,
      `}`,
      `.mark svg {`,
      `  fill: var(--accent-text);`,
      `}`,
    ].join("\n");
    expect(lines(css)).toEqual([2, 5]);
  });

  it("finds a violation nested inside @layer and @media", () => {
    // Every module in this repo is wrapped in `@layer components` — a detector that only
    // walked top-level rules would pass the entire codebase vacuously.
    const css = `@layer components { @media (min-width: 40rem) { .icon { color: var(--accent-text); } } }`;
    expect(lines(css)).toEqual([1]);
  });

  describe("QA — independent adversarial: detector gaps", () => {
    it("catches the ink-on-the-CONTROL pattern — a glyph painted via currentColor inheritance", () => {
      // The repo's own convention (SchemeToggle.module.css): the ink is declared AND painted on
      // `.toggle`, and the glyph — a Lucide SVG taking `currentColor` — receives only geometry
      // on `.icon`. The paint site is the button rule, whose selector names no graphic, so the
      // guard never inspects it: swap the ink to a text role and `pnpm lint:icon` stays green
      // while the slice's one mounted icon reads `--muted-foreground`. The header's own doc
      // ("`color` counts: an SVG taking `currentColor` … is painted by it") only holds when the
      // `color` declaration sits on a graphic-named rule — which this codebase's flagship icon
      // consumer does not do.
      const css = [
        `.toggle { --scheme-toggle-ink: var(--muted-foreground); color: var(--scheme-toggle-ink); }`,
        `.icon { inline-size: var(--size-icon); block-size: var(--size-icon); }`,
      ].join("\n");
      expect(lines(css)).toEqual([1]);
    });

    it("catches the SHIPPED SchemeToggle module with its ink swapped to the text tier", () => {
      // Bind the gap to the real file, so a refactor of the module keeps this pin honest.
      const real = readFileSync(
        resolve(
          process.cwd(),
          "src/components/site-chrome/SchemeToggle.module.css",
        ),
        "utf8",
      );
      const sabotaged = real.replace("var(--icon)", "var(--muted-foreground)");
      expect(sabotaged).toContain("var(--muted-foreground)");
      expect(findIconRoleViolations(sabotaged).length).toBeGreaterThan(0);
    });

    it("does not flag a TEXT rule whose selector merely MENTIONS a graphic part", () => {
      // The subject of `.logo + .caption` is the caption — text. The detector matches any
      // graphic word anywhere in the selector, not the selector's SUBJECT (its rightmost
      // compound), so a legitimate muted caption beside a logo fails `pnpm lint:icon`.
      expect(
        lines(`.logo + .caption { color: var(--muted-foreground); }`),
      ).toEqual([]);
      expect(
        lines(`.card:has(> .icon) { color: var(--muted-foreground); }`),
      ).toEqual([]);
    });

    it("does not flag prose class names that merely CONTAIN a graphic word", () => {
      // `.markdown` contains "mark"; `.logout` contains "logo" — both are text surfaces. In a
      // digital garden, a `.markdown` body rule reading `--muted-foreground` is routine and
      // would be blocked by CI the day it lands.
      expect(lines(`.markdown { color: var(--muted-foreground); }`)).toEqual(
        [],
      );
      expect(lines(`.logout { color: var(--muted-foreground); }`)).toEqual([]);
    });

    it("follows an underscore-named component token — any valid custom property name", () => {
      // `--icon_ink` is a valid <custom-property-name>; the resolver's `[a-z0-9-]` pattern
      // stops at the underscore, so the indirection launders the text role past the check.
      expect(
        lines(
          `.icon { --icon_ink: var(--muted-foreground); color: var(--icon_ink); }`,
        ),
      ).toEqual([1]);
    });
  });
});
