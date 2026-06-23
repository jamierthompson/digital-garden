import { describe, expect, it } from "vitest";

import { found, isNotFound, notFound } from "./notFound";

describe("resolution result", () => {
  it("found() wraps a value on the success branch", () => {
    const result = found(42);
    expect(result.found).toBe(true);
    expect(result.value).toBe(42);
    expect(isNotFound(result)).toBe(false);
  });

  it("notFound() carries the kind and echoes the unresolved key", () => {
    const result = notFound("embed", "ghost-widget");
    expect(result.found).toBe(false);
    expect(result.kind).toBe("embed");
    expect(result.key).toBe("ghost-widget");
    expect(isNotFound(result)).toBe(true);
  });

  it("isNotFound narrows the union so callers reach .value safely", () => {
    const result = found("ok");
    if (isNotFound(result)) {
      throw new Error("expected a found result");
    }
    // After the guard, TypeScript knows `result` is Found<string>.
    expect(result.value).toBe("ok");
  });
});
