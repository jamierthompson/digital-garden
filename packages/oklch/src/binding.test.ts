import { describe, expect, it } from "vitest";

import {
  minPass,
  resolveBinding,
  resolveTokens,
  type BindingContext,
  type TokenBinding,
} from "./binding";
import { buildRamp } from "./ramp";
import { apcaLc, contrastWCAG, type ContrastTarget } from "./contrast";
import type { OkLCH, Ramp, RampRole } from "./types";

// A near-neutral ramp (whisper of hue) and a full-chroma accent ramp — the two the default
// schema binds against — plus canonical light/dark worst-case surfaces from the neutral ramp.
const neutral: Ramp = buildRamp({ hue: 260, chroma: 0.01, gamut: "srgb" });
const accentRamp: Ramp = buildRamp({ hue: 260, chroma: 0.15, gamut: "srgb" });
const lightSurface: OkLCH = neutral.find((s) => s.label === "200")!.color; // L ≈ 0.92
const darkSurface: OkLCH = neutral.find((s) => s.label === "800")!.color; // L ≈ 0.27

const meets = (fg: OkLCH, bg: OkLCH, t: ContrastTarget): boolean =>
  contrastWCAG(fg, bg) >= t.wcag && apcaLc(fg, bg) >= t.apca;

const BODY: ContrastTarget = { wcag: 4.5, apca: 75 };
const UI: ContrastTarget = { wcag: 3, apca: 45 };

describe("minPass", () => {
  it("on a LIGHT surface, binds to a darker step that clears the target", () => {
    const step = minPass(neutral, lightSurface, BODY);
    // The chosen step really clears the true floor (minPass solves with a hair of margin).
    expect(meets(step.color, lightSurface, BODY)).toBe(true);
    // Body text on a light surface is darker than that surface.
    expect(step.color.L).toBeLessThan(lightSurface.L);
  });

  it("on a DARK surface, binds to a LIGHTER step (polarity reverses)", () => {
    const step = minPass(neutral, darkSurface, BODY);
    expect(meets(step.color, darkSurface, BODY)).toBe(true);
    expect(step.color.L).toBeGreaterThan(darkSurface.L);
  });

  it("returns the LEAST-EXTREME passing step — the next step toward the surface fails", () => {
    const step = minPass(neutral, lightSurface, UI);
    const idx = neutral.findIndex((s) => s.label === step.label);
    // On a light surface minPass walks lightest→darkest, so the step one lighter (idx-1),
    // being closer to the surface, must NOT already clear — else minPass overshot.
    if (idx > 0) {
      expect(meets(neutral[idx - 1].color, lightSurface, UI)).toBe(false);
    }
    expect(meets(step.color, lightSurface, UI)).toBe(true);
  });

  it("falls back to the extreme (darkest) step on a light surface when NOTHING passes", () => {
    // WCAG maxes out at 21; 30 is unreachable, so no step clears → darkest-end fallback.
    const impossible: ContrastTarget = { wcag: 30, apca: 200 };
    const step = minPass(neutral, lightSurface, impossible);
    expect(step.label).toBe("950");
  });

  it("falls back to the extreme (lightest) step on a dark surface when NOTHING passes", () => {
    const impossible: ContrastTarget = { wcag: 30, apca: 200 };
    const step = minPass(neutral, darkSurface, impossible);
    expect(step.label).toBe("50");
  });

  it("clears even a full-chroma accent ramp via gamut-desaturated dark steps (yellow-ish)", () => {
    const yellow = buildRamp({ hue: 90, chroma: 0.18, gamut: "srgb" });
    const step = minPass(yellow, lightSurface, BODY);
    // A high-chroma hue can't host body text at mid-lightness, but its dark steps desaturate
    // under gamut-mapping, so minPass still lands a passing step (never throws / never fails).
    expect(meets(step.color, lightSurface, BODY)).toBe(true);
  });

  it("stays least-extreme on a MID-lightness background — picks the closest passing step, not a far extreme", () => {
    // A mid-grey bg (L ≈ 0.5) is where a naive `bg.L ≥ 0.5` scan could return a wrong-polarity
    // extreme. The returned step must clear the target AND be the passing step closest to bg
    // in lightness (minimal |ΔL|), regardless of polarity.
    const midBg: OkLCH = { L: 0.5, C: 0, H: 0 };
    const step = minPass(neutral, midBg, UI);
    expect(meets(step.color, midBg, UI)).toBe(true);
    const dl = Math.abs(step.color.L - midBg.L);
    for (const s of neutral) {
      if (meets(s.color, midBg, UI)) {
        expect(Math.abs(s.color.L - midBg.L)).toBeGreaterThanOrEqual(
          dl - 1e-12,
        );
      }
    }
  });
});

describe("resolveBinding", () => {
  const ramps = { neutral, accent: accentRamp } as unknown as Record<
    RampRole,
    Ramp
  >;
  const accent: OkLCH = { L: 0.5, C: 0.15, H: 260 };
  const accentForeground: OkLCH = { L: 0.99, C: 0, H: 260 };
  const accentProvenance = {
    kind: "fill" as const,
    role: "accent" as const,
    hue: 260,
    seed: { native: true, deltaL: 0 },
  };
  const accentForegroundProvenance = {
    kind: "fill-foreground" as const,
    role: "accent" as const,
    pole: "white" as const,
    hue: 260,
    chroma: 0,
    backedOff: false,
  };
  const hoverProvenance = {
    kind: "fill" as const,
    role: "accent" as const,
    hue: 260,
    seed: { native: false, deltaL: -0.1 },
  };
  const hoverFill: OkLCH = { L: 0.4, C: 0.15, H: 260 };
  const baseCtx: Omit<BindingContext, "scheme"> = {
    ramps,
    worstSurface: lightSurface,
    // The co-solves are computed by palette.ts and passed in verbatim, keyed by role;
    // resolveBinding forwards each role's fill/label + provenance (identity — asserted below).
    fills: {
      accent: {
        fill: accent,
        fillForeground: accentForeground,
        fillProvenance: accentProvenance,
        fillForegroundProvenance: accentForegroundProvenance,
      },
    },
    hovers: {
      accent: { fill: hoverFill, provenance: hoverProvenance },
    },
  };

  it("`step` picks the scheme's label (light vs dark) and reports it as provenance", () => {
    const b: TokenBinding = {
      kind: "step",
      role: "neutral",
      light: "50",
      dark: "950",
    };
    const light = resolveBinding(b, { ...baseCtx, scheme: "light" });
    expect(light.color).toEqual(neutral.find((s) => s.label === "50")!.color);
    expect(light.step).toEqual({ kind: "step", role: "neutral", label: "50" });
    const dark = resolveBinding(b, { ...baseCtx, scheme: "dark" });
    expect(dark.color).toEqual(neutral.find((s) => s.label === "950")!.color);
    expect(dark.step).toEqual({ kind: "step", role: "neutral", label: "950" });
  });

  it("`auto` runs minPass against surface-elevated and reports the winning step", () => {
    const b: TokenBinding = { kind: "auto", role: "neutral", target: BODY };
    const chosen = minPass(neutral, lightSurface, BODY);
    const got = resolveBinding(b, { ...baseCtx, scheme: "light" });
    expect(got.color).toEqual(chosen.color);
    // The reported step is the one minPass actually chose — and its color IS the value.
    expect(got.step).toEqual({
      kind: "step",
      role: "neutral",
      label: chosen.label,
    });
    if (got.step?.kind !== "step")
      throw new Error("expected a step provenance");
    const step = got.step; // capture so the narrowing survives into the closure below
    const reported = neutral.find((s) => s.label === step.label)!;
    expect(reported.color).toEqual(got.color);
  });

  it("`literal` bakes a fixed value per scheme, reporting a literal provenance with its alpha (#160)", () => {
    const light: OkLCH = { L: 1, C: 0, H: 0 };
    const dark: OkLCH = { L: 0.15, C: 0, H: 0, alpha: 0.6 };
    const b: TokenBinding = { kind: "literal", light, dark };
    const l = resolveBinding(b, { ...baseCtx, scheme: "light" });
    expect(l.color).toBe(light);
    // Opaque literal → alpha 1; a literal makes no contrast claim, so alpha is its only story.
    expect(l.step).toEqual({ kind: "literal", alpha: 1 });
    const d = resolveBinding(b, { ...baseCtx, scheme: "dark" });
    expect(d.color).toBe(dark);
    expect(d.step).toEqual({ kind: "literal", alpha: 0.6 });
  });

  it("`fill` / `fill-foreground` defer to the role's co-solve, forwarding its provenance report (#151/#160)", () => {
    const a = resolveBinding(
      { kind: "fill", role: "accent" },
      { ...baseCtx, scheme: "light" },
    );
    expect(a.color).toBe(accent);
    // Not null any more — the fill reports the co-solve story it was handed, verbatim.
    expect(a.step).toBe(accentProvenance);
    const on = resolveBinding(
      { kind: "fill-foreground", role: "accent" },
      { ...baseCtx, scheme: "light" },
    );
    expect(on.color).toBe(accentForeground);
    expect(on.step).toBe(accentForegroundProvenance);
  });

  it("`fill` keys by ROLE — a status fill forwards its OWN co-solve, never the accent's (#160)", () => {
    const errorFill: OkLCH = { L: 0.55, C: 0.14, H: 27 };
    const errorProvenance = {
      kind: "fill" as const,
      role: "error" as const,
      hue: 27,
      seed: null,
    };
    const ctx: Omit<BindingContext, "scheme"> = {
      ...baseCtx,
      ramps: { ...ramps, error: accentRamp } as unknown as Record<
        RampRole,
        Ramp
      >,
      fills: {
        ...baseCtx.fills,
        error: {
          fill: errorFill,
          fillForeground: accentForeground,
          fillProvenance: errorProvenance,
          fillForegroundProvenance: accentForegroundProvenance,
        },
      },
    };
    const e = resolveBinding(
      { kind: "fill", role: "error" },
      { ...ctx, scheme: "light" },
    );
    expect(e.color).toBe(errorFill);
    // Truthful receipt: the error fill's provenance names `error`, with `seed: null`.
    expect(e.step).toBe(errorProvenance);
  });

  it("`fill-hover` defers to the role's hover co-solve (#160)", () => {
    const h = resolveBinding(
      { kind: "fill-hover", role: "accent" },
      { ...baseCtx, scheme: "light" },
    );
    expect(h.color).toBe(hoverFill);
    expect(h.step).toBe(hoverProvenance);
  });

  it("`auto-on` runs minPass against a PINNED step of the same role, reporting the winning step (#160)", () => {
    // A subtle step on the accent ramp; the label solves against THAT color, not surface-elevated.
    const subtleLabel = "100";
    const subtle = accentRamp.find((s) => s.label === subtleLabel)!.color;
    const b: TokenBinding = {
      kind: "auto-on",
      role: "accent",
      against: { light: subtleLabel, dark: "900" },
      target: BODY,
    };
    const chosen = minPass(accentRamp, subtle, BODY);
    const got = resolveBinding(b, { ...baseCtx, scheme: "light" });
    expect(got.color).toEqual(chosen.color);
    expect(got.step).toEqual({
      kind: "step",
      role: "accent",
      label: chosen.label,
    });
    // The label really clears its target against the subtle surface's ACTUAL color.
    expect(meets(got.color, subtle, BODY)).toBe(true);
  });

  it("a `fill`/`fill-foreground`/`fill-hover` with NO co-solve for its role never throws (defensive)", () => {
    // A hand-authored schema can name a role the context didn't co-solve; the binding must
    // still resolve to a sane ramp step rather than crashing (engine never-throws guarantee).
    const bare: Omit<BindingContext, "scheme"> = {
      ramps,
      worstSurface: lightSurface,
      fills: {},
      hovers: {},
    };
    for (const kind of ["fill", "fill-foreground", "fill-hover"] as const) {
      const got = resolveBinding(
        { kind, role: "neutral" },
        { ...bare, scheme: "light" },
      );
      expect(got.color).toBeDefined();
      expect(got.step?.kind).toBe("step");
    }
  });

  it("resolveTokens visits every key, returning parallel tokens + provenance", () => {
    const schema = {
      background: { kind: "step", role: "neutral", light: "50", dark: "950" },
      foreground: { kind: "auto", role: "neutral", target: BODY },
      accent: { kind: "fill", role: "accent" },
    } as unknown as Record<
      "background" | "foreground" | "accent",
      TokenBinding
    >;
    const { tokens, bindings } = resolveTokens(schema as never, {
      ...baseCtx,
      scheme: "light",
    });
    expect(Object.keys(tokens)).toEqual(["background", "foreground", "accent"]);
    expect(Object.keys(bindings)).toEqual([
      "background",
      "foreground",
      "accent",
    ]);
    expect(tokens.accent).toBe(accent);
    // A stepped binding reports its (role, label); the continuous accent forwards its report.
    expect(bindings.background).toEqual({
      kind: "step",
      role: "neutral",
      label: "50",
    });
    expect(bindings.accent).toBe(accentProvenance);
  });
});
