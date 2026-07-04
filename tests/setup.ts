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
