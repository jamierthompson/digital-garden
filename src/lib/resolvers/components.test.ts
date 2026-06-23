import { describe, expect, it } from "vitest";

import { resolveComponentKey } from "./components";
import { isNotFound } from "./notFound";

describe("resolveComponentKey", () => {
  it("returns a typed NotFound for any key while the registry is empty (Phase 3)", () => {
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
