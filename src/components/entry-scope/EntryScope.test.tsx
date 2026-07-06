import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// See roster.test.ts: next/font/google is untransformed under Vitest, so mock the faces
// the roster imports (loaded transitively via EntryScope → resolveScope → FONT_FACES).
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import { FONT_FACES } from "@/fonts/roster";

import EntryScope from "./EntryScope";
import { FONT_STACK } from "./scopeSeed";

const VALID_SEED = {
  slug: "oklch-engine",
  fontKey: "jetbrains-mono",
} as const;

// The inline `--font-face` on a scope wrapper, read straight off the element's style so the
// assertion doesn't depend on jsdom computing custom properties.
const fontFaceOf = (el: Element | null): string =>
  (el as HTMLElement).style.getPropertyValue("--font-face");

// EntryScope is a SYNC server component, so jsdom can render it (async RSCs cannot).
describe("EntryScope (font slot)", () => {
  it("wraps children in the scoped [data-entry] and mounts the resolved font class", () => {
    render(
      <EntryScope seed={VALID_SEED}>
        <p>module content</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("module content").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "oklch-engine");
    // The resolved roster face's `.variable` className is on the wrapper.
    expect(wrapper).toHaveClass(FONT_FACES["jetbrains-mono"].variable);
  });

  it("maps --font-face inline to the resolved roster face + fallback stack", () => {
    render(
      <EntryScope seed={VALID_SEED}>
        <p>themed</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("themed").closest("[data-entry]");
    const { cssVariable } = FONT_FACES["jetbrains-mono"];
    expect(fontFaceOf(wrapper)).toBe(`var(${cssVariable}), ${FONT_STACK}`);
  });

  it("keeps a safe unregistered slug as its own scope (never throws)", () => {
    // An entry without a component module still gets its OWN sanitized scope — not a shared
    // `fallback` — so two such entries can't cross-contaminate each other.
    expect(() =>
      render(
        <EntryScope seed={{ slug: "nope", fontKey: "inter" }}>
          <p>still rendered</p>
        </EntryScope>,
      ),
    ).not.toThrow();
    expect(
      screen.getByText("still rendered").closest("[data-entry]"),
    ).toHaveAttribute("data-entry", "nope");
  });

  it("degrades to the constant fallback scope only for an empty/garbage slug", () => {
    render(
      <EntryScope seed={{ slug: "   ", fontKey: "inter" }}>
        <p>fallback scope</p>
      </EntryScope>,
    );
    expect(
      screen.getByText("fallback scope").closest("[data-entry]"),
    ).toHaveAttribute("data-entry", "fallback");
  });

  it("uses the shell mono face (no roster class) but still maps --font-face when the fontKey misses", () => {
    // An unknown fontKey resolves to the shell mono face, which has no roster `.variable`
    // class — so the wrapper carries no (empty) className — but `--font-face` still maps to the
    // shell var, never a bare/empty value.
    render(
      <EntryScope seed={{ slug: "oklch-engine", fontKey: "nope" }}>
        <p>shell font</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("shell font").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "oklch-engine");
    expect(wrapper).not.toHaveAttribute("class");
    expect(fontFaceOf(wrapper)).toBe(`var(--font-geist-mono), ${FONT_STACK}`);
  });

  it("never throws on garbage input and still renders children in the fallback scope", () => {
    expect(() =>
      render(
        // `seed` is typed `unknown`, so a hostile primitive is a valid prop here —
        // resolveScope collapses it to the fallback scope.
        <EntryScope seed={42}>
          <p>survived</p>
        </EntryScope>,
      ),
    ).not.toThrow();
    expect(
      screen.getByText("survived").closest("[data-entry]"),
    ).toHaveAttribute("data-entry", "fallback");
  });

  it("gives two distinct entries their OWN inline font (per-element, no cross-slot bleed)", () => {
    // The inline style is per-element, so two co-mounted slots can never share (or overwrite)
    // one another's font — the failure a shared hoisted <style> once risked.
    render(
      <>
        <EntryScope seed={{ slug: "alpha", fontKey: "inter" }}>
          <p>a</p>
        </EntryScope>
        <EntryScope seed={{ slug: "beta", fontKey: "fraunces" }}>
          <p>b</p>
        </EntryScope>
      </>,
    );
    const a = screen.getByText("a").closest("[data-entry]");
    const b = screen.getByText("b").closest("[data-entry]");
    expect(a).toHaveAttribute("data-entry", "alpha");
    expect(b).toHaveAttribute("data-entry", "beta");
    expect(fontFaceOf(a)).toBe(
      `var(${FONT_FACES.inter.cssVariable}), ${FONT_STACK}`,
    );
    expect(fontFaceOf(b)).toBe(
      `var(${FONT_FACES.fraunces.cssVariable}), ${FONT_STACK}`,
    );
  });
});
