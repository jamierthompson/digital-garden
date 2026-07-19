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
});
