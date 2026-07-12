import { describe, expect, it } from "vitest";

import { EMBED_KEYS } from "@/lib/keys";

import { resolveEmbedKey } from "./embeds";
import { isNotFound } from "./resolution";

describe("resolveEmbedKey", () => {
  // QA #131 — the positive contract: EVERY registered key must resolve to a loader whose
  // module default-exports a component. `satisfies` catches a MISSING loader at compile
  // time, but not a loader whose import path points at the wrong module — only loading it
  // does.
  it.each(EMBED_KEYS)("resolves '%s' to a loadable component", async (key) => {
    const result = resolveEmbedKey(key);
    expect(isNotFound(result)).toBe(false);
    if (isNotFound(result)) throw new Error("expected Found");
    const mod = (await result.value()) as { default?: unknown };
    expect(typeof mod.default).toBe("function");
  });

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

  // Pins the Object.hasOwn guard (QA-131 D1): the widened `Record<string, …>` view is
  // a plain object, so an unguarded index would resolve INHERITED prototype members
  // ("__proto__", "constructor") as Found and crash the entry page downstream. These
  // keys must stay NotFound.
  it.each(["__proto__", "constructor", "toString"])(
    "treats the prototype-inherited name '%s' as NotFound",
    (key) => {
      expect(isNotFound(resolveEmbedKey(key))).toBe(true);
    },
  );
});
