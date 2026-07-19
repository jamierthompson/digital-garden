import { describe, expect, it } from "vitest";

import { rampSetToDeclarations, tokenSetToDeclarations } from "./css";
import { buildTokenSet } from "./palette";
import { formatOklch } from "./convert";

describe("tokenSetToDeclarations", () => {
  const set = buildTokenSet("#3b82f6");
  const decls = tokenSetToDeclarations(set);

  it("omits color-scheme by DEFAULT so a scoped slot inherits it (#159)", () => {
    // A slot must not re-declare color-scheme: it's inherited, so re-declaring `light dark`
    // shadows a forced root override (the site-wide toggle) and the slot follows the OS.
    expect(decls).not.toContain("color-scheme");
  });

  it("emits color-scheme only when the caller opts in (#159 — e.g. a :root export)", () => {
    const withScheme = tokenSetToDeclarations(set, { colorScheme: true });
    expect(withScheme).toContain("color-scheme: light dark;");
    // It leads the block so the scheme is established before the tokens resolve.
    expect(withScheme.split("\n")[0]).toBe("color-scheme: light dark;");
  });

  it("emits the generic semantic public contract as bare -- names (no ramp tier)", () => {
    expect(decls).toContain("--background:");
    expect(decls).toContain("--accent:");
    expect(decls).toContain("--ring:");
    // The 37-token contract (#160, #229): the neutral `muted` background + the `accent-subtle`
    // pair, status trios/subtle surfaces, interaction states, scrim.
    expect(decls).toContain("--muted:");
    expect(decls).toContain("--accent-subtle:");
    expect(decls).toContain("--accent-subtle-foreground:");
    expect(decls).toContain("--error-foreground:");
    expect(decls).toContain("--error-subtle:");
    expect(decls).toContain("--success-subtle-foreground:");
    expect(decls).toContain("--accent-hover:");
    expect(decls).toContain("--surface-selected:");
    expect(decls).toContain("--scrim:");
    // The semantic tier is self-contained: none of the `--<role>-<step>` ramp primitives
    // leak in (that tier is a separate opt-in, `rampSetToDeclarations`). `--neutral-*` is the
    // clean discriminator — a pure ramp namespace with no semantic-token counterpart, unlike
    // `--accent-*`, which legitimately carries semantic roles (`--accent-hover`, `--accent-text`).
    expect(decls).not.toContain("--neutral-");
    expect(decls).not.toContain("--accent-500");
    // No project-internal alias leaks out of the engine.
    expect(decls).not.toContain("--logx-");
    // Exactly the 38 semantic tokens — nothing else (no color-scheme by default, #159).
    expect(decls.split("\n")).toHaveLength(38);
  });

  it("bakes literal oklch() values inside light-dark()", () => {
    expect(decls).toMatch(
      /--background: light-dark\(oklch\([^)]+\), oklch\([^)]+\)\);/,
    );
  });
});

describe("rampSetToDeclarations", () => {
  const set = buildTokenSet("#3b82f6");
  const ramps = rampSetToDeclarations(set);

  it("emits the per-role 50…950 ramp primitives baked as light-dark() (#98)", () => {
    // One representative step from each role, plus both ends of a ramp.
    for (const decl of [
      "--accent-50:",
      "--accent-500:",
      "--accent-950:",
      "--neutral-200:",
      "--success-500:",
      "--error-500:",
      "--warning-500:",
      "--info-500:",
    ]) {
      expect(ramps).toContain(decl);
    }
    expect(ramps).toMatch(
      /--accent-500: light-dark\(oklch\([^)]+\), oklch\([^)]+\)\);/,
    );
    // 6 roles × 11 steps — the full primitive tier, no semantic tokens mixed in.
    expect(ramps.split("\n")).toHaveLength(6 * 11);
    expect(ramps).not.toContain("--accent:");
  });

  it("zips each step's LIGHT and DARK literals into light-dark() in the right order", () => {
    // A transposed/duplicated-scheme zip would still match the shape regex above; assert the
    // two literals are exactly the role's light[i] and dark[i] steps for a representative step.
    const { light, dark } = set.ramps.accent;
    const i = light.findIndex((s) => s.label === "500");
    expect(ramps).toContain(
      `--accent-500: light-dark(${formatOklch(light[i].color)}, ${formatOklch(dark[i].color)});`,
    );
  });

  // QA (adversarial, #256 round): removing tokenSetToCss also removed the only test that
  // drove the ramp tier through a non-default ColorFormat — the api.test.ts freeze guard
  // runs the default format only, so a broken opts path here would pass the whole suite.
  describe("QA — CssOptions forwarding", () => {
    it("serializes ramp values per ColorFormat on request, defaulting to native oklch (#99)", () => {
      expect(ramps).toContain("light-dark(oklch(");
      const hex = rampSetToDeclarations(set, { format: "hex" });
      expect(hex).toMatch(
        /--accent-500: light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\);/,
      );
      expect(hex).not.toContain("oklch(");
      const rgb = rampSetToDeclarations(set, { format: "rgb" });
      expect(rgb).toMatch(
        /--neutral-500: light-dark\(rgb\(\d+ \d+ \d+\), rgb\(\d+ \d+ \d+\)\);/,
      );
    });
  });
});

describe("QA — adversarial: scrim + determinism through the CSS serializers (#160)", () => {
  const set = buildTokenSet("#3b82f6");

  it("carries the scrim alpha in every ColorFormat", () => {
    expect(tokenSetToDeclarations(set)).toContain(
      "--scrim: light-dark(oklch(0.13 0 0 / 0.6), oklch(0.13 0 0 / 0.6));",
    );
    expect(tokenSetToDeclarations(set, { format: "hex" })).toMatch(
      /--scrim: light-dark\(#[0-9a-f]{6}99, #[0-9a-f]{6}99\);/,
    );
    expect(tokenSetToDeclarations(set, { format: "rgb" })).toMatch(
      /--scrim: light-dark\(rgb\(\d+ \d+ \d+ \/ 0\.6\), rgb\(\d+ \d+ \d+ \/ 0\.6\)\);/,
    );
  });

  it("two independent builds serialize byte-identically", () => {
    const again = buildTokenSet("#3b82f6");
    expect(tokenSetToDeclarations(again)).toBe(tokenSetToDeclarations(set));
    expect(rampSetToDeclarations(again)).toBe(rampSetToDeclarations(set));
  });
});
