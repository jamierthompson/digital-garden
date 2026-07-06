import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { resolveThemeDeclarations, themeInitScript } from "@/lib/theme";

import PageTheme from "./PageTheme";

const SEED = "#c2410c";
const accentOf = (seed: unknown): string =>
  Object.fromEntries(resolveThemeDeclarations(seed))["--accent"];

afterEach(() => document.documentElement.removeAttribute("style"));

describe("PageTheme", () => {
  it("emits the baked hard-load script carrying the seed's resolved declarations", () => {
    const { container } = render(<PageTheme seed={SEED} />);
    const script = container.querySelector("script");
    expect(script).not.toBeNull();
    expect(script?.innerHTML).toContain("setProperty");
    // The seed's actual accent value is baked into the parse-time script.
    expect(script?.innerHTML).toContain(accentOf(SEED));
  });

  it("wires the re-applier so <html> is themed (hydration / soft-nav path)", () => {
    render(<PageTheme seed={SEED} />);
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      accentOf(SEED),
    );
  });

  it("does not throw on an unparseable seed (defensive engine)", () => {
    expect(() => render(<PageTheme seed={{ nonsense: true }} />)).not.toThrow();
  });

  // --- Adversarial QA (#172): both halves must ride ONE resolution, and no hostile seed
  // may reach the inline script through the composed component. ---

  describe("QA — single resolution and hostile seeds", () => {
    it("bakes EXACTLY themeInitScript(resolveThemeDeclarations(seed)) — both halves share one resolution", () => {
      const { container } = render(<PageTheme seed={SEED} />);
      expect(container.querySelector("script")?.innerHTML).toBe(
        themeInitScript(resolveThemeDeclarations(SEED)),
      );
    });

    it("a script-injection seed cannot reach the baked inline script (falls back, payload absent)", () => {
      const payload = "</script><script>alert(1)</script>";
      const { container } = render(<PageTheme seed={payload} />);
      const html = container.querySelector("script")?.innerHTML ?? "";
      expect(html).not.toBe("");
      expect(html.toLowerCase()).not.toContain("</script");
      expect(html).not.toContain("alert(1)");
      // …and the page still gets the full fallback theme, not a blank one.
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
