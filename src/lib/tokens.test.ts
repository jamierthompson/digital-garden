import { describe, expect, it } from "vitest";

import { space, type SpaceStep } from "./tokens";

describe("space()", () => {
  it("maps every real scale step to its exact custom-property reference", () => {
    const steps: SpaceStep[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const step of steps) {
      expect(space(step)).toBe(`var(--space-${step})`);
    }
  });

  it("is pure and side-effect-free — same input, same output, no mutation", () => {
    expect(space(6)).toBe("var(--space-6)");
    expect(space(6)).toBe("var(--space-6)");
  });

  // Contract-vs-runtime: the SpaceStep union blocks off-scale numbers at COMPILE time, but TS
  // erases at runtime — `space()` has no runtime guard, so a value that slips past the type (an
  // `as SpaceStep` cast, untyped JS, bad external data) is interpolated verbatim into a
  // `var(--space-N)` that FOUNDATION.CSS DOES NOT DEFINE. It resolves to an invalid/empty var, so
  // the consuming `gap` silently collapses to no gap rather than failing loudly. This pins the
  // current (unguarded) behavior so adding a runtime guard later is a conscious change, not a
  // silent one — and documents the sharp edge for callers reaching past the type.
  it("has NO runtime guard: an off-scale value cast past the type yields a nonexistent token", () => {
    expect(space(0 as SpaceStep)).toBe("var(--space-0)"); // --space-0 was intentionally dropped
    expect(space(10 as SpaceStep)).toBe("var(--space-10)"); // --space-10 was intentionally dropped
    expect(space(-1 as SpaceStep)).toBe("var(--space--1)"); // structurally malformed token name
    expect(space(2.5 as SpaceStep)).toBe("var(--space-2.5)"); // non-integer, no such step
    expect(space(NaN as unknown as SpaceStep)).toBe("var(--space-NaN)");
  });

  it("keeps space() and foundation.css in lockstep — every emitted step exists in the sheet", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const sheet = readFileSync(
      resolve(process.cwd(), "src/styles/foundation.css"),
      "utf8",
    );
    const steps: SpaceStep[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const step of steps) {
      // space(step) emits var(--space-N); that N MUST be declared in foundation.css, or a caller
      // using the typed accessor gets a dead var. Guards the accessor↔scale contract the docs claim.
      expect(sheet).toMatch(new RegExp(`--space-${step}\\s*:`));
    }
    // And the dropped steps stay dropped (no --space-0 / --space-10 headroom crept back).
    expect(sheet).not.toMatch(/--space-0\s*:/);
    expect(sheet).not.toMatch(/--space-10\s*:/);
  });
});
