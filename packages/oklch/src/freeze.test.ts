import { describe, expect, it } from "vitest";

import { deepFreeze } from "./freeze";

describe("deepFreeze", () => {
  it("freezes the top object AND every nested object (deep, not shallow)", () => {
    const obj = deepFreeze({
      a: { wcag: 4.5, apca: 75 },
      b: { nested: { deep: 1 } },
    });
    expect(Object.isFrozen(obj)).toBe(true);
    expect(Object.isFrozen(obj.a)).toBe(true);
    expect(Object.isFrozen(obj.b)).toBe(true);
    expect(Object.isFrozen(obj.b.nested)).toBe(true);
  });

  it("returns the SAME reference, at its original type", () => {
    const obj = { x: 1 };
    expect(deepFreeze(obj)).toBe(obj);
  });

  it("makes a nested write a no-op / throw — the value cannot be mutated", () => {
    const obj = deepFreeze({ tier: { wcag: 4.5 } }) as {
      tier: { wcag: number };
    };
    // ESM strict mode throws on a frozen property; loose mode no-ops. Either way, unchanged.
    expect(() => {
      obj.tier.wcag = 21;
    }).toThrow();
    expect(obj.tier.wcag).toBe(4.5);
  });

  it("freezes array contents too", () => {
    const arr = deepFreeze([{ a: 1 }, { b: 2 }]);
    expect(Object.isFrozen(arr)).toBe(true);
    expect(Object.isFrozen(arr[0])).toBe(true);
  });

  it("is idempotent and cycle-safe (an already-frozen / shared child is skipped)", () => {
    const shared = Object.freeze({ s: 1 });
    // A structure that reuses an already-frozen child must not recurse forever or throw.
    const obj = deepFreeze({ one: shared, two: { ref: shared } });
    expect(Object.isFrozen(obj.two)).toBe(true);
    // Re-freezing a frozen structure returns it unchanged.
    expect(deepFreeze(obj)).toBe(obj);
  });

  it("passes primitives and null straight through", () => {
    expect(deepFreeze(null)).toBeNull();
    expect(deepFreeze(42)).toBe(42);
    expect(deepFreeze("x")).toBe("x");
    expect(deepFreeze(undefined)).toBeUndefined();
  });
});
