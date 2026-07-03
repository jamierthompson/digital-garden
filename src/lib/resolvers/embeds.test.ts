import { describe, expect, it } from "vitest";

import { resolveEmbedKey } from "./embeds";
import { isNotFound } from "./resolution";

describe("resolveEmbedKey", () => {
  it("returns a typed NotFound for an unregistered key", () => {
    const result = resolveEmbedKey("hue-slider");
    expect(isNotFound(result)).toBe(true);
    if (!isNotFound(result)) throw new Error("expected NotFound");
    expect(result.kind).toBe("embed");
    expect(result.key).toBe("hue-slider");
  });

  it("returns NotFound for the retired mock embed key (it no longer resolves)", () => {
    // The proof-of-concept `sunrise-meter` widget was purged (#109); its key must now miss
    // cleanly. The essay serializer renders the missing-embed placeholder rather than crash.
    expect(isNotFound(resolveEmbedKey("sunrise-meter"))).toBe(true);
  });

  it("never throws on an unresolved key", () => {
    expect(() => resolveEmbedKey("anything-at-all")).not.toThrow();
  });
});
