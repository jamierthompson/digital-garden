import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// See roster.test.ts: next/font/google is untransformed under Vitest, so mock the faces
// the roster imports (loaded transitively via ProjectScope → resolveScope → FONT_FACES).
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import { FONT_FACES } from "@/fonts/roster";

import ProjectScope from "./ProjectScope";
import { BRAND_LAYER } from "./scopeSeed";

const VALID_SEED = {
  slug: "oklch-engine",
  brandColor: "oklch(0.62 0.21 264)",
  fontKey: "jetbrains-mono",
} as const;

// ProjectScope is a SYNC server component, so jsdom can render it (async RSCs cannot).
// React serializes the `<style precedence>` as `data-precedence` in <head>, so we can
// observe it; the actual flush-before-paint ordering is verified in the browser.
describe("ProjectScope (engine-driven)", () => {
  it("wraps children in the scoped [data-project] and mounts the resolved font class", () => {
    render(
      <ProjectScope seed={VALID_SEED}>
        <p>module content</p>
      </ProjectScope>,
    );
    const wrapper = screen
      .getByText("module content")
      .closest("[data-project]");
    expect(wrapper).toHaveAttribute("data-project", "oklch-engine");
    // The resolved roster face's `.variable` className is on the wrapper.
    expect(wrapper).toHaveClass(FONT_FACES["jetbrains-mono"].variable);
  });

  it("hoists the theme <style> with precedence == the brand @layer", () => {
    render(
      <ProjectScope seed={VALID_SEED}>
        <p>themed</p>
      </ProjectScope>,
    );
    // `data-precedence` == BRAND_LAYER proves the hoist order and the `@layer ${BRAND_LAYER}`
    // wrapper are driven by the SAME value — they cannot desync.
    const style = document.head.querySelector("style[data-precedence]");
    expect(style).not.toBeNull();
    expect(style).toHaveAttribute("data-precedence", BRAND_LAYER);
    expect(style?.textContent).toContain(`@layer ${BRAND_LAYER} {`);
  });

  it("keeps a safe unregistered slug as its own scope (never throws)", () => {
    // A project without a component module still gets its OWN sanitized scope — not a shared
    // `fallback` — so two such projects can't cross-contaminate each other's theme.
    expect(() =>
      render(
        <ProjectScope
          seed={{ slug: "nope", brandColor: "#0099ff", fontKey: "inter" }}
        >
          <p>still rendered</p>
        </ProjectScope>,
      ),
    ).not.toThrow();
    expect(
      screen.getByText("still rendered").closest("[data-project]"),
    ).toHaveAttribute("data-project", "nope");
  });

  it("degrades to the constant fallback scope only for an empty/garbage slug", () => {
    render(
      <ProjectScope
        seed={{ slug: "   ", brandColor: "#0099ff", fontKey: "inter" }}
      >
        <p>fallback scope</p>
      </ProjectScope>,
    );
    expect(
      screen.getByText("fallback scope").closest("[data-project]"),
    ).toHaveAttribute("data-project", "fallback");
  });

  it("renders without a font class when the fontKey falls back to the shell face", () => {
    // An unknown fontKey resolves to the shell mono face, which has no roster `.variable`
    // class — so the wrapper carries no (empty) className attribute.
    render(
      <ProjectScope
        seed={{ slug: "oklch-engine", brandColor: "#0099ff", fontKey: "nope" }}
      >
        <p>shell font</p>
      </ProjectScope>,
    );
    const wrapper = screen.getByText("shell font").closest("[data-project]");
    expect(wrapper).toHaveAttribute("data-project", "oklch-engine");
    expect(wrapper).not.toHaveAttribute("class");
  });

  it("never throws on garbage input and still renders children", () => {
    expect(() =>
      render(
        // `seed` is typed `unknown`, so a hostile primitive is a valid prop here —
        // resolveScope collapses it to the fallback scope.
        <ProjectScope seed={42}>
          <p>survived</p>
        </ProjectScope>,
      ),
    ).not.toThrow();
    expect(
      screen.getByText("survived").closest("[data-project]"),
    ).toHaveAttribute("data-project", "fallback");
  });
});
