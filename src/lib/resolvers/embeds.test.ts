import { describe, expect, it } from "vitest";

import { resolveEmbedKey } from "./embeds";
import { isNotFound } from "./notFound";

describe("resolveEmbedKey", () => {
  it("returns a typed NotFound for any key while the registry is empty", () => {
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
