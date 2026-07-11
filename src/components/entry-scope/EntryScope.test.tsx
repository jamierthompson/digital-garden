import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// See roster.test.ts: next/font/google is untransformed under Vitest, so mock the faces
// the roster imports (loaded transitively via EntryScope → resolveScope → FONT_FACES).
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
}));

import { FONT_FACES } from "@/fonts/roster";

import EntryScope from "./EntryScope";

// A seed that themes all three roles with distinct roster faces.
const ALL_THREE = {
  slug: "oklch-engine",
  headingFont: "space-grotesk",
  bodyFont: "newsreader",
  monoFont: "inter",
} as const;

// The per-role generic family that tails each override (heading→sans-serif, body→serif,
// mono→monospace) — the ONLY fallback appended after the face's var.
const GENERIC = {
  "--font-heading": "sans-serif",
  "--font-body": "serif",
  "--font-mono": "monospace",
} as const;

// Read an inline custom property straight off the element's style, so the assertion doesn't
// depend on jsdom computing cascaded custom properties.
const propOf = (el: Element | null, property: string): string =>
  (el as HTMLElement).style.getPropertyValue(property);

// EntryScope is a SYNC server component, so jsdom can render it (async RSCs cannot).
describe("EntryScope (three-role font slot)", () => {
  it("wraps children in the scoped [data-entry] and mounts each resolved face's class", () => {
    render(
      <EntryScope seed={ALL_THREE}>
        <p>module content</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("module content").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "oklch-engine");
    // Every resolved roster face's `.variable` className is on the wrapper.
    expect(wrapper).toHaveClass(FONT_FACES["space-grotesk"].variable);
    expect(wrapper).toHaveClass(FONT_FACES.newsreader.variable);
    expect(wrapper).toHaveClass(FONT_FACES.inter.variable);
  });

  it("emits an override per resolved role: var(<face>) + the role's generic", () => {
    render(
      <EntryScope seed={ALL_THREE}>
        <p>themed</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("themed").closest("[data-entry]");
    expect(propOf(wrapper, "--font-heading")).toBe(
      `var(${FONT_FACES["space-grotesk"].cssVariable}), ${GENERIC["--font-heading"]}`,
    );
    expect(propOf(wrapper, "--font-body")).toBe(
      `var(${FONT_FACES.newsreader.cssVariable}), ${GENERIC["--font-body"]}`,
    );
    expect(propOf(wrapper, "--font-mono")).toBe(
      `var(${FONT_FACES.inter.cssVariable}), ${GENERIC["--font-mono"]}`,
    );
    // The wrapper carries no inline `font-family` — the body baseline that CONSUMES `--font-body`
    // is a static `[data-entry]` rule in reset.css (pinned by reset.test.ts); this component emits
    // only the per-entry token values.
    expect(propOf(wrapper, "font-family")).toBe("");
  });

  it("never appends the site palette or a self-reference to an override", () => {
    // The tail is the CSS generic keyword ONLY — a `var(--font-body)` self-reference would be a
    // CSS cycle (the whole declaration dropped) and appending the palette face would hardcode
    // what the slot must inherit. Guard both.
    render(
      <EntryScope seed={{ slug: "e", bodyFont: "newsreader" }}>
        <p>body only</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("body only").closest("[data-entry]");
    const body = propOf(wrapper, "--font-body");
    expect(body).toBe(`var(${FONT_FACES.newsreader.cssVariable}), serif`);
    // No self-reference, and no site-palette faces leaked into the value.
    expect(body).not.toContain("var(--font-body)");
    expect(body).not.toContain("--font-source-serif-4");
    expect(body).not.toContain("--font-space-grotesk");
  });

  it("omits the override for an absent role so it inherits :root", () => {
    render(
      <EntryScope seed={{ slug: "e", bodyFont: "newsreader" }}>
        <p>partial</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("partial").closest("[data-entry]");
    // Only the body role was seeded → heading + mono emit NO inline override (inherit).
    expect(propOf(wrapper, "--font-body")).not.toBe("");
    expect(propOf(wrapper, "--font-heading")).toBe("");
    expect(propOf(wrapper, "--font-mono")).toBe("");
    // Only the body face's class mounts.
    expect(wrapper).toHaveClass(FONT_FACES.newsreader.variable);
    expect(wrapper).not.toHaveClass(FONT_FACES["space-grotesk"].variable);
  });

  it("omits the override for a role whose key does not resolve", () => {
    render(
      <EntryScope
        seed={{ slug: "e", bodyFont: "not-a-font", monoFont: "inter" }}
      >
        <p>bad body</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("bad body").closest("[data-entry]");
    // Unknown body key → no body override; the resolvable mono sibling still applies.
    expect(propOf(wrapper, "--font-body")).toBe("");
    expect(propOf(wrapper, "--font-mono")).toBe(
      `var(${FONT_FACES.inter.cssVariable}), monospace`,
    );
  });

  it("emits NO class attribute and NO overrides when no role resolves", () => {
    render(
      <EntryScope seed={{ slug: "e", bodyFont: "nope" }}>
        <p>all inherit</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("all inherit").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "e");
    // No resolvable face → no class attribute (avoid an empty class) and every role inherits.
    expect(wrapper).not.toHaveAttribute("class");
    expect(propOf(wrapper, "--font-heading")).toBe("");
    expect(propOf(wrapper, "--font-body")).toBe("");
    expect(propOf(wrapper, "--font-mono")).toBe("");
  });

  it("keeps a safe unregistered slug as its own scope (never throws)", () => {
    // An entry without a component module still gets its OWN sanitized scope — not a shared
    // `fallback` — so two such entries can't cross-contaminate each other.
    expect(() =>
      render(
        <EntryScope seed={{ slug: "nope", bodyFont: "inter" }}>
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
      <EntryScope seed={{ slug: "   ", bodyFont: "inter" }}>
        <p>fallback scope</p>
      </EntryScope>,
    );
    expect(
      screen.getByText("fallback scope").closest("[data-entry]"),
    ).toHaveAttribute("data-entry", "fallback");
  });

  it("never throws on garbage input and still renders children in the fallback scope", () => {
    expect(() =>
      render(
        // `seed` is typed `unknown`, so a hostile primitive is a valid prop here —
        // resolveScope collapses it to the fallback scope with no faces.
        <EntryScope seed={42}>
          <p>survived</p>
        </EntryScope>,
      ),
    ).not.toThrow();
    const wrapper = screen.getByText("survived").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "fallback");
    expect(wrapper).not.toHaveAttribute("class");
  });

  it("gives two distinct entries their OWN inline fonts (per-element, no cross-slot bleed)", () => {
    // The inline style is per-element, so two co-mounted slots can never share (or overwrite)
    // one another's fonts — the failure a shared hoisted <style> once risked.
    render(
      <>
        <EntryScope seed={{ slug: "alpha", bodyFont: "inter" }}>
          <p>a</p>
        </EntryScope>
        <EntryScope seed={{ slug: "beta", bodyFont: "fraunces" }}>
          <p>b</p>
        </EntryScope>
      </>,
    );
    const a = screen.getByText("a").closest("[data-entry]");
    const b = screen.getByText("b").closest("[data-entry]");
    expect(a).toHaveAttribute("data-entry", "alpha");
    expect(b).toHaveAttribute("data-entry", "beta");
    expect(propOf(a, "--font-body")).toBe(
      `var(${FONT_FACES.inter.cssVariable}), serif`,
    );
    expect(propOf(b, "--font-body")).toBe(
      `var(${FONT_FACES.fraunces.cssVariable}), serif`,
    );
  });
});
