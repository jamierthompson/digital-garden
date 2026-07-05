import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

// jsdom implements neither `window.matchMedia` nor MediaQueryList, and components read
// the viewer's color scheme through it (e.g. StudioProvider). The stub never matches, so
// tests render the light view by default; a test that needs the dark branch stubs
// `matchMedia` itself (`vi.stubGlobal`) — unstubbing restores this default.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }) as unknown as MediaQueryList,
  });
}

// jsdom implements no `ResizeObserver` at all (not even a non-matching stub, unlike
// `matchMedia` above) — any component that measures itself on mount throws a
// `ReferenceError` in tests, not just renders unmeasured. First real trigger: Radix's
// `ScrollArea` (`src/components/ui/ScrollArea.tsx`, #139's canvas-template scroll container),
// whose `Scrollbar`/`Thumb` call `new ResizeObserver(...)` unconditionally in a layout effect
// regardless of `type`. A no-op stub is the standard fix for this exact, well-known jsdom gap
// (every Radix-based test suite hits it) — tests don't assert on measured geometry (that's the
// browser check's job per `docs/working-with-agents.md`), so a no-op is sufficient; it only
// needs to exist so the effect doesn't throw. Unconditional (no "already defined" guard, unlike
// a real-browser polyfill would need): this file is jsdom-only test setup, which never has one.
if (typeof window !== "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}
