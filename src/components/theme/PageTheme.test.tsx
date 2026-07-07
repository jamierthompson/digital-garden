import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { resolveThemeDeclarations } from "@/lib/theme";

import PageTheme from "./PageTheme";

const SEED = "#c2410c";
const accentOf = (seed: unknown): string =>
  Object.fromEntries(resolveThemeDeclarations(seed))["--accent"];

afterEach(() => document.documentElement.removeAttribute("style"));

describe("PageTheme", () => {
  it("emits a :root <style> carrying the seed's baked declarations (flash-free first paint)", () => {
    const html = renderToStaticMarkup(<PageTheme seed={SEED} />);
    expect(html).toContain(":root{");
    // The seed's actual accent value is baked into the server-rendered CSS — no script.
    expect(html).toContain(accentOf(SEED));
  });

  it("re-applies the theme to <html> on the client (soft-nav path)", () => {
    render(<PageTheme seed={SEED} />);
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      accentOf(SEED),
    );
  });

  it("does not throw on an unparseable seed (defensive engine)", () => {
    expect(() => render(<PageTheme seed={{ nonsense: true }} />)).not.toThrow();
  });

  describe("QA — hostile & empty seeds", () => {
    it("a hostile seed is rejected by the engine (payload absent, full fallback theme)", () => {
      const payload = "</style><script>alert(1)</script>";
      const html = renderToStaticMarkup(<PageTheme seed={payload} />);
      // The engine collapses a garbage seed to the fallback — no seed content reaches the CSS.
      expect(html).not.toContain("alert(1)");
      expect(html).not.toContain("<script");
      render(<PageTheme seed={payload} />);
      expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
        accentOf(undefined),
      );
    });

    it("null and undefined seeds render the complete fallback theme", () => {
      for (const seed of [null, undefined]) {
        const { unmount } = render(<PageTheme seed={seed} />);
        expect(
          document.documentElement.style.getPropertyValue("--accent"),
        ).toBe(accentOf(undefined));
        unmount();
        document.documentElement.removeAttribute("style");
      }
    });
  });
});
