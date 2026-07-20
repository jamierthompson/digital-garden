import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The base `h1`–`h6` rule is the ONE place headings bind the display face. Pinned here so the drift
 * it guards — a heading forgetting `--font-heading` and inheriting the body serif — is impossible.
 */
const RAW = readFileSync(
  resolve(process.cwd(), "src/styles/reset.css"),
  "utf8",
);
const CODE = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

describe("reset.css cascade layer", () => {
  it("wraps its rules in `@layer base` so they lose to component modules", () => {
    expect(CODE).toMatch(/@layer\s+base\s*\{/);
  });

  it("declares no retired `@layer foundation`/`@layer semantic`", () => {
    expect(CODE).not.toMatch(/@layer\s+(foundation|semantic)\b/);
  });
});

describe("reset.css scrollbar gutter", () => {
  it("reserves the gutter on every route so centered lanes never shift across navigation", () => {
    expect(CODE).toMatch(/scrollbar-gutter:\s*stable/);
  });
});

describe("reset.css base heading element rule", () => {
  const headingRule = CODE.match(
    /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{([^}]*)\}/,
  );

  it("binds --font-heading on h1–h6", () => {
    expect(headingRule).not.toBeNull();
    expect(/font-family:\s*var\(--font-heading\)/.test(headingRule![1])).toBe(
      true,
    );
  });
});

/**
 * QA — the sticky header obscures focus targets that carry no `id`.
 *
 * The slice mitigates WCAG 2.2 SC 2.4.11 (Focus Not Obscured, Minimum) with
 * `[id] { scroll-margin-block-start }`, which only offsets elements that HAVE an id. The
 * failure it misses: with the header revealed (any upward scroll reveals it), Shift+Tab
 * backwards through the page scrolls the next focusable to the TOP edge of the viewport —
 * and if that element has no `id`, which nav links, buttons and body links generally do
 * not, it lands underneath the band. `:focus-within` does not help: focus is in the page,
 * not the header.
 *
 * The standard fix covers every scroll-into-view at once — focus-driven scrolling,
 * `:target` jumps, `scrollIntoView()` and find-in-page — by offsetting the SCROLL PORT
 * rather than each target: `html { scroll-padding-block-start: … }`
 * (https://www.w3.org/TR/css-scroll-snap-1/#scroll-padding). It also subsumes the `[id]`
 * rule, which currently applies to every id'd element on the page whether or not it is ever
 * a scroll target.
 *
 * Expected to FAIL against the slice as delivered.
 */
describe("reset.css sticky-header scroll offset", () => {
  it("offsets the scroll port so ANY focus target clears the sticky band", () => {
    const htmlRule = CODE.match(/(?:^|\s)html\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(htmlRule, "expected an `html { … }` rule").not.toBe("");
    expect(htmlRule).toMatch(/scroll-padding-block-start:\s*var\(--space-9\)/);
  });

  it("keeps the anchor-jump offset in step with the band's own hide threshold", () => {
    // `NavVisibility` will not hide the band within HIDE_MIN_Y_PX (96px) of the top, and the
    // offset must clear the band's tallest height — the two numbers are the same measurement
    // read twice. --space-9 is 6rem = 96px; a change to either must move both.
    expect(CODE).toMatch(
      /scroll-(margin|padding)-block-start:\s*var\(--space-9\)/,
    );
  });
});

describe("reset.css base anchor ink rule", () => {
  // Isolate `a { … }` — not `a:hover`/`a:focus`, and not the `canvas`/`textarea` element rules.
  const anchorRule = CODE.match(/(?:^|\s)a\s*\{([^}]*)\}/)?.[1] ?? "";

  it("makes anchors inherit ambient ink so TextLink owns link colour", () => {
    expect(anchorRule).toMatch(/color:\s*inherit/);
  });

  it("touches colour only — the UA underline stays as the non-colour link cue (WCAG 1.4.1)", () => {
    expect(anchorRule).not.toMatch(/text-decoration/);
  });
});
