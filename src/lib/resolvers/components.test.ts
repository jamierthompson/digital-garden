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

  // Every declared ComponentKey (currently none) must resolve to a module whose default
  // satisfies the ProjectModule contract (a renderable, props-free `Experience`). Iterating
  // the source-of-truth key array means the first real module that lands with a broken or
  // missing loader trips here, not in prod. Guarded so an empty registry is a passing no-op.
  it("resolves every declared ComponentKey to a valid, mountable ProjectModule", async () => {
    for (const key of COMPONENT_KEYS) {
      const result = resolveComponentKey(key);
      expect(isNotFound(result)).toBe(false);
      if (isNotFound(result)) throw new Error(`expected a loader for ${key}`);
      const mod = (await result.value()) as {
        default: { Experience: unknown };
      };
      expect(mod.default).toBeTruthy();
      expect(typeof mod.default.Experience).toBe("function");
      const Experience = mod.default.Experience as React.ComponentType;
      expect(isValidElement(createElement(Experience))).toBe(true);
    }
  });
});
