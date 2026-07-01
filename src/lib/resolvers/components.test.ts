import { createElement, isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { COMPONENT_KEYS } from "@/lib/keys";

import { resolveComponentKey } from "./components";
import { isNotFound } from "./resolution";

describe("resolveComponentKey", () => {
  it("resolves a registered key to a loader (first-light)", () => {
    const result = resolveComponentKey("first-light");
    expect(isNotFound(result)).toBe(false);
    if (isNotFound(result)) throw new Error("expected a resolved loader");
    expect(typeof result.value).toBe("function");
  });

  it("resolves the shared engine-board key to a module with an Experience", async () => {
    // engine-board is the seed brands' shared componentKey (#65) — not unique per project.
    const result = resolveComponentKey("engine-board");
    expect(isNotFound(result)).toBe(false);
    if (isNotFound(result)) throw new Error("expected a resolved loader");
    const mod = (await result.value()) as { default: { Experience: unknown } };
    expect(typeof mod.default.Experience).toBe("function");
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

  // --- Adversarial QA additions (fresh, no-prior-context) ---

  // Every declared ComponentKey must resolve to a module whose default satisfies the
  // ProjectModule contract (a renderable `Experience`). Iterating the source-of-truth
  // key array means a NEW key with a broken/missing loader trips here, not in prod.
  it.each([...COMPONENT_KEYS])(
    "resolves %s to a module whose default is a valid ProjectModule",
    async (key) => {
      const result = resolveComponentKey(key);
      expect(isNotFound(result)).toBe(false);
      if (isNotFound(result)) throw new Error(`expected a loader for ${key}`);
      const mod = (await result.value()) as {
        default: { Experience: unknown };
      };
      expect(mod.default).toBeTruthy();
      expect(typeof mod.default.Experience).toBe("function");
      // The Experience is a real, mountable, props-free component — createElement must
      // yield a valid React element (catches a non-component default export).
      const Experience = mod.default.Experience as React.ComponentType;
      expect(isValidElement(createElement(Experience))).toBe(true);
    },
  );
});
