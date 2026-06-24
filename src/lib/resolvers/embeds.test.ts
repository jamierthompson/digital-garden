import { describe, expect, it } from "vitest";

import { resolveEmbedKey } from "./embeds";
import { isNotFound } from "./resolution";

describe("resolveEmbedKey", () => {
  it("resolves a registered key to a loader (sunrise-meter, Phase 3)", () => {
    const result = resolveEmbedKey("sunrise-meter");
    expect(isNotFound(result)).toBe(false);
    if (isNotFound(result)) throw new Error("expected a resolved loader");
    expect(typeof result.value).toBe("function");
  });

  it("returns a typed NotFound for an unregistered key", () => {
    const result = resolveEmbedKey("hue-slider");
    expect(isNotFound(result)).toBe(true);
    if (!isNotFound(result)) throw new Error("expected NotFound");
    expect(result.kind).toBe("embed");
    expect(result.key).toBe("hue-slider");
  });

  it("never throws on an unresolved key", () => {
    expect(() => resolveEmbedKey("anything-at-all")).not.toThrow();
  });
});
