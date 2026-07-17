import { createElement, isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { COMPONENT_KEYS } from "@/lib/keys";

import { resolveComponentKey } from "./components";
import { isNotFound } from "./resolution";

describe("resolveComponentKey", () => {
  it("returns a typed NotFound for an unregistered key", () => {
    const result = resolveComponentKey("log-explorer");
    expect(isNotFound(result)).toBe(true);
    if (!isNotFound(result)) throw new Error("expected NotFound");
    expect(result.kind).toBe("component");
    expect(result.key).toBe("log-explorer");
  });

  it("returns NotFound for the retired mock keys (they no longer resolve)", () => {
    // The proof-of-concept modules were purged (#109); their keys must now miss cleanly
    // rather than resolve. A published doc still pointing at one is caught by the
    // published-keys drift net, not a runtime crash here.
    for (const key of ["first-light", "engine-board"]) {
      expect(isNotFound(resolveComponentKey(key))).toBe(true);
    }
  });

  it("never throws on an unresolved key", () => {
    expect(() => resolveComponentKey("anything-at-all")).not.toThrow();
  });

  // Every declared ComponentKey must resolve to a module whose default satisfies the
  // EntryModule contract — at least one composition member (`Slot` and/or
  // `Provider`), each a renderable component. Iterating the source-of-truth key array
  // means any module that lands with a broken or missing loader trips here, not in
  // prod. Guarded so an empty registry is still a passing no-op.
  it("resolves every declared ComponentKey to a valid, mountable EntryModule", async () => {
    for (const key of COMPONENT_KEYS) {
      const result = resolveComponentKey(key);
      expect(isNotFound(result)).toBe(false);
      if (isNotFound(result)) throw new Error(`expected a loader for ${key}`);
      const mod = (await result.value()) as {
        default: { Provider?: unknown; Sidebar?: unknown; Canvas?: unknown };
      };
      expect(mod.default).toBeTruthy();
      const members = [
        mod.default.Provider,
        mod.default.Sidebar,
        mod.default.Canvas,
      ].filter((member) => member !== undefined);
      expect(
        members.length,
        `${key} exports no composition member`,
      ).toBeGreaterThan(0);
      for (const member of members) {
        expect(typeof member).toBe("function");
        const Member = member as React.ComponentType<{ slug: string }>;
        expect(isValidElement(createElement(Member, { slug: key }))).toBe(true);
      }
    }
  });
  // Pins the Object.hasOwn guard (QA-131 D1): same prototype-lookup hole as
  // resolveSlotKey — an unguarded plain-object index would return "__proto__"/
  // "constructor" as Found, pass EntryPage's drift guard, and crash on `.value()`.
  // These keys must stay NotFound.
  it.each(["__proto__", "constructor"])(
    "treats the prototype-inherited name '%s' as NotFound",
    (key) => {
      expect(isNotFound(resolveComponentKey(key))).toBe(true);
    },
  );
});
