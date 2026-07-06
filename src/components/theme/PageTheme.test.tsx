import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { resolveThemeDeclarations } from "@/lib/theme";

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
});
