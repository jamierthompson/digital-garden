import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyScheme,
  getResolvedScheme,
  getStoredScheme,
  SCHEME_INIT_SCRIPT,
  SCHEME_STORAGE_KEY,
  setScheme,
  subscribe,
} from "./scheme";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("style");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getStoredScheme", () => {
  it("returns null when no override is persisted (follow the OS)", () => {
    expect(getStoredScheme()).toBeNull();
  });

  it("reads a persisted explicit override", () => {
    localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
    expect(getStoredScheme()).toBe("dark");
  });

  it("ignores an unrecognized stored value (treats it as no override)", () => {
    localStorage.setItem(SCHEME_STORAGE_KEY, "sepia");
    expect(getStoredScheme()).toBeNull();
  });

  it("survives storage being unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(getStoredScheme()).toBeNull();
  });
});

describe("applyScheme", () => {
  it("writes an inline color-scheme for the chosen scheme", () => {
    applyScheme("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    applyScheme("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});

describe("setScheme", () => {
  it("persists and applies the chosen scheme", () => {
    setScheme("dark");
    expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("still applies when storage writes throw (private mode)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => setScheme("dark")).not.toThrow();
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});

describe("subscribe", () => {
  it("notifies on a same-tab setScheme and stops after unsubscribe", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribe(onChange);
    setScheme("dark");
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
    setScheme("light");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("re-applies and notifies on a cross-tab storage change", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribe(onChange);
    localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
    window.dispatchEvent(
      new StorageEvent("storage", { key: SCHEME_STORAGE_KEY }),
    );
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("ignores storage changes for unrelated keys", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribe(onChange);
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(onChange).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("getResolvedScheme", () => {
  it("returns the explicit override when one is set", () => {
    setScheme("dark");
    expect(getResolvedScheme()).toBe("dark");
  });

  it("falls back to the OS preference with no override", () => {
    // The setup stub's matchMedia never matches ⇒ light.
    expect(getResolvedScheme()).toBe("light");
  });

  it("reads dark from the OS preference with no override", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    expect(getResolvedScheme()).toBe("dark");
  });
});

describe("SCHEME_INIT_SCRIPT", () => {
  it("references the storage key and only sets color-scheme for light/dark", () => {
    expect(SCHEME_INIT_SCRIPT).toContain(JSON.stringify(SCHEME_STORAGE_KEY));
    expect(SCHEME_INIT_SCRIPT).toContain(
      "document.documentElement.style.colorScheme",
    );
    expect(SCHEME_INIT_SCRIPT).toContain('s==="light"||s==="dark"');
  });

  it("is self-guarding (a try/catch, so a storage throw can't break first paint)", () => {
    expect(SCHEME_INIT_SCRIPT).toMatch(/try\s*\{/);
    expect(SCHEME_INIT_SCRIPT).toMatch(/catch\s*\(/);
  });

  it("applies a persisted dark override when executed against the DOM", () => {
    localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
    new Function(SCHEME_INIT_SCRIPT)();
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("does nothing with no override (native light dark stays in effect)", () => {
    new Function(SCHEME_INIT_SCRIPT)();
    expect(document.documentElement.style.colorScheme).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Adversarial QA — edges/errors the author's happy-path suite skipped.
// ---------------------------------------------------------------------------

/**
 * A `matchMedia` stub that actually captures the `change` handlers, so a test can fire an OS
 * scheme change and assert the store's reaction (the setup stub's `addEventListener` is a
 * no-op `vi.fn()`, which can't). Uses the same `vi.stubGlobal("matchMedia", …)` seam the
 * existing dark-branch test relies on; `vi.unstubAllGlobals()` in afterEach restores the default.
 */
function stubCapturingMatchMedia(initialMatches: boolean): {
  fireChange: (matches: boolean) => void;
  handlerCount: () => number;
} {
  const handlers = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches: initialMatches,
    addEventListener: (_: string, h: (e: { matches: boolean }) => void) =>
      handlers.add(h),
    removeEventListener: (_: string, h: (e: { matches: boolean }) => void) =>
      handlers.delete(h),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return {
    fireChange: (matches: boolean) => {
      mql.matches = matches;
      handlers.forEach((h) => h({ matches }));
    },
    handlerCount: () => handlers.size,
  };
}

describe("QA — adversarial", () => {
  describe("getStoredScheme — hostile / malformed stored values", () => {
    // Every non-(light|dark) string must resolve to "no override" (⇒ follow the OS), never
    // throw and never leak a truthy value into `applyScheme`. Includes the legacy tri-state
    // value "system" (graceful migration: an old persisted "system" now just means follow-OS)
    // and prototype-pollution-shaped strings.
    const hostile = [
      "system", // legacy value from the removed tri-state control
      "banana",
      "{}",
      "",
      " dark ", // whitespace not trimmed
      "Dark", // wrong case
      "LIGHT",
      "null",
      "undefined",
      "__proto__",
      "constructor",
      "0",
      "[object Object]",
    ];
    for (const value of hostile) {
      it(`treats ${JSON.stringify(value)} as no override`, () => {
        localStorage.setItem(SCHEME_STORAGE_KEY, value);
        expect(getStoredScheme()).toBeNull();
      });
    }
  });

  describe("SCHEME_INIT_SCRIPT — pre-paint safety (an inline throw = white page)", () => {
    it("does not throw and sets nothing for a malformed persisted value", () => {
      localStorage.setItem(SCHEME_STORAGE_KEY, "banana");
      expect(() => new Function(SCHEME_INIT_SCRIPT)()).not.toThrow();
      expect(document.documentElement.style.colorScheme).toBe("");
    });

    it("does not throw when storage access itself throws (private mode)", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("denied");
      });
      expect(() => new Function(SCHEME_INIT_SCRIPT)()).not.toThrow();
    });

    it("is self-contained — no import/require/module reference (runs before any bundle)", () => {
      expect(SCHEME_INIT_SCRIPT).not.toMatch(/\bimport\b/);
      expect(SCHEME_INIT_SCRIPT).not.toMatch(/\brequire\b/);
      expect(SCHEME_INIT_SCRIPT).not.toMatch(/\bexport\b/);
    });

    it("is idempotent — running it twice leaves the same applied scheme", () => {
      localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
      new Function(SCHEME_INIT_SCRIPT)();
      new Function(SCHEME_INIT_SCRIPT)();
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });

    it("applies EXACTLY what the client store would apply (no init↔client drift)", () => {
      localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
      // What the pre-paint script sets…
      new Function(SCHEME_INIT_SCRIPT)();
      const fromInitScript = document.documentElement.style.colorScheme;
      // …must equal what the hydrated client store sets for the same persisted value.
      document.documentElement.removeAttribute("style");
      applyScheme(getResolvedScheme());
      expect(document.documentElement.style.colorScheme).toBe(fromInitScript);
      expect(fromInitScript).toBe("dark");
    });
  });

  describe("setScheme — rapid toggling", () => {
    it("settles on the last value in storage and on the DOM", () => {
      setScheme("dark");
      setScheme("light");
      setScheme("dark");
      setScheme("light");
      expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBe("light");
      expect(document.documentElement.style.colorScheme).toBe("light");
    });

    it("fires the change signal once per call", () => {
      const onChange = vi.fn();
      const unsubscribe = subscribe(onChange);
      setScheme("dark");
      setScheme("light");
      setScheme("dark");
      expect(onChange).toHaveBeenCalledTimes(3);
      unsubscribe();
    });
  });

  describe("subscribe — teardown & re-entrancy", () => {
    it("double-unsubscribe is safe (no throw)", () => {
      const unsubscribe = subscribe(vi.fn());
      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();
    });

    it("after unsubscribe, a cross-tab storage change no longer notifies OR re-applies", () => {
      const onChange = vi.fn();
      const unsubscribe = subscribe(onChange);
      unsubscribe();
      localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
      window.dispatchEvent(
        new StorageEvent("storage", { key: SCHEME_STORAGE_KEY }),
      );
      expect(onChange).not.toHaveBeenCalled();
      expect(document.documentElement.style.colorScheme).toBe("");
    });

    it("removes its OS-change listener on unsubscribe (no leak)", () => {
      const media = stubCapturingMatchMedia(false);
      const unsubscribe = subscribe(vi.fn());
      expect(media.handlerCount()).toBe(1);
      unsubscribe();
      expect(media.handlerCount()).toBe(0);
    });

    it("ignores a storage event with a null key (e.g. localStorage.clear in another tab)", () => {
      const onChange = vi.fn();
      const unsubscribe = subscribe(onChange);
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
      expect(onChange).not.toHaveBeenCalled();
      unsubscribe();
    });
  });

  describe("OS change vs. an explicit override", () => {
    it("an OS flip notifies, but the override still wins in getResolvedScheme", () => {
      const media = stubCapturingMatchMedia(false);
      setScheme("dark"); // explicit override
      const onChange = vi.fn();
      const unsubscribe = subscribe(onChange);
      media.fireChange(false); // OS says light…
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(getResolvedScheme()).toBe("dark"); // …override still wins
      unsubscribe();
    });

    it("with no override, getResolvedScheme tracks the OS preference", () => {
      const media = stubCapturingMatchMedia(false);
      expect(getResolvedScheme()).toBe("light");
      media.fireChange(true);
      expect(getResolvedScheme()).toBe("dark");
    });
  });

  describe("getResolvedScheme — storage unavailable", () => {
    it("falls back to the OS preference when getItem throws", () => {
      stubCapturingMatchMedia(true);
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("denied");
      });
      expect(getResolvedScheme()).toBe("dark");
    });
  });

  describe("cross-tab clear — a hostile/removed value written by another tab", () => {
    // If another tab replaces the override with an invalid value (or removes it), the storage
    // handler CLEARS this tab's inline scheme so the DOM and getResolvedScheme() agree — no
    // DOM ⇄ state drift. (Low severity in practice: setScheme never writes an invalid value and
    // the binary UI has no "return to system", so the stored value is normally light/dark.)
    it("clears the stale inline scheme so it does not drift from the resolved state", () => {
      setScheme("dark");
      const onChange = vi.fn();
      const unsubscribe = subscribe(onChange);
      // Another tab clobbers the key with garbage, then the storage event arrives here.
      localStorage.setItem(SCHEME_STORAGE_KEY, "banana");
      window.dispatchEvent(
        new StorageEvent("storage", { key: SCHEME_STORAGE_KEY }),
      );
      expect(onChange).toHaveBeenCalledTimes(1);
      // The inline override is cleared (native light dark resumes)…
      expect(document.documentElement.style.colorScheme).toBe("");
      // …so the DOM and the resolved state agree on the OS preference (light) — no drift.
      expect(getResolvedScheme()).toBe("light");
      unsubscribe();
    });
  });
});
