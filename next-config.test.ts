import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pins a LOAD-BEARING, otherwise-invisible build setting the scheme toggle (#133) depends on
 * (same pragmatic guard-the-config approach as `layout.test.ts`).
 *
 * Turbopack's Lightning CSS, at the default browser targets, transpiles `light-dark()` into a
 * `var(--lightningcss-light) var(--lightningcss-dark)` polyfill toggled by
 * `@media (prefers-color-scheme)` — i.e. keyed on the OS, ignoring the `color-scheme` property.
 * That silently defeats the whole token model's premise (set `color-scheme` on :root ⇒ every
 * token re-resolves): a forced override could then only ever agree with the OS. Excluding
 * `light-dark` from transpilation emits the NATIVE function, which follows `color-scheme`.
 * If this setting is dropped, the toggle half-breaks in a way no other test catches (editorial
 * chrome still flips via inline `color-scheme`, but only when the choice matches the OS), so
 * pin it here. Documented knob (Next 16.2+, applies to Turbopack): useLightningcss.md.
 */
describe("next.config — Lightning CSS keeps light-dark() native", () => {
  const config = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

  it("excludes `light-dark` from Lightning CSS transpilation", () => {
    // Tolerate formatting/quote style; assert the feature name sits inside a lightningCssFeatures block.
    expect(config).toMatch(/lightningCssFeatures/);
    expect(config).toMatch(/exclude\s*:\s*\[[^\]]*["']light-dark["'][^\]]*\]/);
  });

  describe("QA — adversarial", () => {
    // The text-match guard above passes on any source that merely CONTAINS the pattern —
    // including a commented-out or otherwise inert line. Assert the actual EVALUATED config
    // value, which only passes when the setting is really in effect.
    it("the evaluated config actually carries the exclude (not just the source text)", async () => {
      const mod = (await import("./next.config")) as {
        default: {
          experimental?: { lightningCssFeatures?: { exclude?: string[] } };
        };
      };
      const exclude = mod.default.experimental?.lightningCssFeatures?.exclude;
      expect(Array.isArray(exclude)).toBe(true);
      expect(exclude).toContain("light-dark");
    });
  });
});
