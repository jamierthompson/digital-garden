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
import { BRAND_LAYER } from "./scopeSeed";

const VALID_SEED = {
  slug: "oklch-engine",
  brandColor: "oklch(0.62 0.21 264)",
  fontKey: "jetbrains-mono",
} as const;

// EntryScope is a SYNC server component, so jsdom can render it (async RSCs cannot).
// React serializes the `<style precedence>` as `data-precedence` in <head>, so we can
// observe it; the actual flush-before-paint ordering is verified in the browser.
describe("EntryScope (engine-driven)", () => {
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

  it("hoists the theme <style> with precedence == the brand @layer", () => {
    render(
      <EntryScope seed={VALID_SEED}>
        <p>themed</p>
      </EntryScope>,
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
        <EntryScope
          seed={{ slug: "nope", brandColor: "#0099ff", fontKey: "inter" }}
        >
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
      <EntryScope
        seed={{ slug: "   ", brandColor: "#0099ff", fontKey: "inter" }}
      >
        <p>fallback scope</p>
      </EntryScope>,
    );
    expect(
      screen.getByText("fallback scope").closest("[data-entry]"),
    ).toHaveAttribute("data-entry", "fallback");
  });

  it("renders without a font class when the fontKey falls back to the shell face", () => {
    // An unknown fontKey resolves to the shell mono face, which has no roster `.variable`
    // class — so the wrapper carries no (empty) className attribute.
    render(
      <EntryScope
        seed={{ slug: "oklch-engine", brandColor: "#0099ff", fontKey: "nope" }}
      >
        <p>shell font</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("shell font").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "oklch-engine");
    expect(wrapper).not.toHaveAttribute("class");
  });

  it("never throws on garbage input and still renders children", () => {
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

  // Theme text for a given scope slug, from the hoisted <style>s (queried by scope selector
  // so results don't bleed across tests via React's head-hoisting).
  const themesFor = (slug: string): string[] =>
    [...document.head.querySelectorAll("style[data-precedence]")]
      .map((s) => s.textContent ?? "")
      .filter((t) => t.includes(`[data-entry="${slug}"]`));

  it("hoists TWO distinct theme <style>s for two distinct projects (no href collision)", () => {
    // DOM-level guard of the React-19 href de-dup mechanism (restores the coverage the
    // deleted shell-theme-dedup test held): distinct projects must NOT share one hoisted
    // theme, or the second slot renders the first's brand.
    render(
      <>
        <EntryScope
          seed={{
            slug: "alpha",
            brandColor: "oklch(0.62 0.21 264)",
            fontKey: "inter",
          }}
        >
          <p>a</p>
        </EntryScope>
        <EntryScope
          seed={{
            slug: "beta",
            brandColor: "oklch(0.62 0.13 30)",
            fontKey: "fraunces",
          }}
        >
          <p>b</p>
        </EntryScope>
      </>,
    );
    expect(themesFor("alpha")).toHaveLength(1);
    expect(themesFor("beta")).toHaveLength(1);
    expect(themesFor("alpha")[0]).not.toBe(themesFor("beta")[0]);
  });

  it("refreshes the hoisted theme when the same slug re-renders with an edited brand (live preview)", () => {
    // The content-hashed href means a same-slug brand edit gets a NEW href, so React inserts
    // the fresh <style> instead of keeping the stale first-committed one.
    const seed = (brandColor: string, fontKey: string) => ({
      slug: "editme",
      brandColor,
      fontKey,
    });
    const { rerender } = render(
      <EntryScope seed={seed("oklch(0.62 0.21 264)", "inter")}>
        <p>v1</p>
      </EntryScope>,
    );
    const before = themesFor("editme");
    expect(before.length).toBeGreaterThanOrEqual(1);

    rerender(
      <EntryScope seed={seed("oklch(0.62 0.13 30)", "fraunces")}>
        <p>v2</p>
      </EntryScope>,
    );
    // A theme carrying the NEW brand now exists and differs from the original — not stale.
    expect(themesFor("editme").some((t) => !before.includes(t))).toBe(true);
  });

  // The href is the load-bearing de-dup key AND part of the naming contract renamed in #132
  // (`project-theme-` → `entry-theme-`). Nothing else pins the PREFIX, so an incomplete
  // rename (or an accidental revert) would ship silently. React 19 serializes the hoisted
  // `<style href precedence>` with the href on `data-href`. Queries are slug-scoped because
  // React head-hoisting accumulates styles across the tests above.
  describe("hoisted-style href contract (#132 rename guard)", () => {
    const hrefs = (): string[] =>
      [...document.head.querySelectorAll("style[data-href]")].map(
        (s) => s.getAttribute("data-href") ?? "",
      );

    it("keys the hoisted theme <style> on an `entry-theme-<slug>-<hash>` href", () => {
      render(
        <EntryScope
          seed={{
            slug: "href-probe",
            brandColor: "oklch(0.62 0.21 264)",
            fontKey: "inter",
          }}
        >
          <p>themed</p>
        </EntryScope>,
      );
      const matching = hrefs().filter((h) => h.includes("href-probe"));
      expect(matching).toHaveLength(1);
      // Prefix is the renamed contract — must be `entry-theme-`, never `project-theme-`.
      expect(matching[0]).toMatch(/^entry-theme-href-probe-[a-z0-9]+$/);
      expect(hrefs().some((h) => h.startsWith("project-theme-"))).toBe(false);
    });

    it("carries the vetted fallback slug in the href for garbage seeds", () => {
      render(
        <EntryScope seed={42}>
          <p>fallback</p>
        </EntryScope>,
      );
      expect(
        hrefs().some((h) => /^entry-theme-fallback-[a-z0-9]+$/.test(h)),
      ).toBe(true);
    });
  });
});
