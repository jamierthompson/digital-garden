import { describe, expect, it } from "vitest";

import { resolveComponentKey } from "./components";
import { isNotFound } from "./resolution";

describe("resolveComponentKey", () => {
  it("resolves a registered key to a loader (first-light, Phase 3)", () => {
    const result = resolveComponentKey("first-light");
    expect(isNotFound(result)).toBe(false);
    if (isNotFound(result)) throw new Error("expected a resolved loader");
    expect(typeof result.value).toBe("function");
  });

  it("returns a typed NotFound for an unregistered key", () => {
    const result = resolveComponentKey("log-explorer");
    expect(isNotFound(result)).toBe(true);
    if (!isNotFound(result)) throw new Error("expected NotFound");
    expect(result.kind).toBe("component");
    expect(result.key).toBe("log-explorer");
  });

  it("never throws on an unresolved key", () => {
    expect(() => resolveComponentKey("anything-at-all")).not.toThrow();
  });
});
