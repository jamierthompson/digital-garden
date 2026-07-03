/**
 * QA (independent, #99): adversarial coverage for the value serializers
 * (`formatHex` / `formatRgb` / `formatColor`), which are PUBLIC exports (`@garden/oklch`)
 * the studio export (#107) routes user/engine colors through.
 *
 * The engine's own token path only ever produces finite OKLCH (`parseColor` guards with
 * `finite()` + fallback), so these non-finite cases are not reached by `buildTokenSet`.
 * But the serializers are exported for any consumer to call on a hand-built OKLCH — and
 * they handle non-finite input INCONSISTENTLY, which these tests pin.
 */

import { describe, expect, it } from "vitest";

import { formatColor, formatHex, formatRgb, parseColor } from "./convert";
import type { OkLCH } from "./types";

describe("serializers — non-finite input (robustness gap, LOW: type-guarded)", () => {
  const nan: OkLCH = { L: NaN, C: NaN, H: NaN };
  const inf: OkLCH = { L: Infinity, C: Infinity, H: Infinity };

  it("PINS the inconsistency: formatHex masks NaN as black, formatRgb emits invalid CSS", () => {
    // formatHex silently produces a valid-LOOKING black (bitwise ops coerce NaN → 0).
    expect(formatHex(nan)).toBe("#000000");
    expect(formatHex(inf)).toBe("#000000");
    // formatRgb emits literally invalid CSS instead — a divergent failure mode for the
    // same bad input. Neither is loud; ideally both would clamp identically (to #000000 /
    // rgb(0 0 0)) or both throw.
    expect(formatRgb(nan)).toBe("rgb(NaN NaN NaN)");
    expect(formatRgb(inf)).toBe("rgb(NaN NaN NaN)");
  });

  it("PINS: formatColor with an out-of-union format returns undefined at runtime", () => {
    // TypeScript blocks this at compile time (ColorFormat is exhaustive, no default arm),
    // but a consumer casting through `any`/`unknown` gets silent `undefined`, not a throw.
    const bad = formatColor({ L: 0.5, C: 0.1, H: 200 }, "hsl" as never);
    expect(bad).toBeUndefined();
  });
});

describe("serializers — sRGB round-trip losslessness (the documented guarantee)", () => {
  it("round-trips every #rgb shorthand color exactly through OKLCH → hex", () => {
    let mismatches = 0;
    for (let i = 0; i < 0x1000; i++) {
      const short = "#" + i.toString(16).padStart(3, "0");
      const long =
        "#" + short[1] + short[1] + short[2] + short[2] + short[3] + short[3];
      const c = parseColor(short);
      expect(c).not.toBeNull();
      if (formatHex(c!) !== long) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it("round-trips assorted 6-digit sRGB hexes exactly", () => {
    for (const hex of [
      "#000000",
      "#ffffff",
      "#123456",
      "#abcdef",
      "#7f7f7f",
      "#010203",
      "#fe00ba",
      "#00ff88",
    ]) {
      expect(formatHex(parseColor(hex)!)).toBe(hex);
    }
  });

  it("serializes a grey (C=0) stably regardless of the meaningless hue", () => {
    // Hue is undefined for greys; it must not leak into the sRGB rendering.
    expect(formatHex({ L: 0.5, C: 0, H: 0 })).toBe(
      formatHex({ L: 0.5, C: 0, H: 359.9 }),
    );
  });
});
