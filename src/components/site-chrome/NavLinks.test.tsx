import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import textLinkStyles from "@/components/ui/TextLink.module.css";

import { readModuleCss, ruleDeclarations } from "../../../tests/cssModule";

// NavLinks reads `usePathname`. Under Vitest there is no App Router context, so mock the
// hook with a mutable holder we can rewrite per test to exercise the active-state matcher.
const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));

import NavLinks from "./NavLinks";

afterEach(() => {
  pathnameMock.mockReset();
});

function activeLinkName(): string | null {
  const active = screen.queryByRole("link", { current: "page" });
  return active ? (active.textContent ?? "") : null;
}

describe("NavLinks — the current-page indicator", () => {
  it("renders every IA destination as a link with its capitalized label", () => {
    pathnameMock.mockReturnValue("/");
    render(<NavLinks />);
    const labels = screen.getAllByRole("link").map((a) => a.textContent);
    expect(labels).toEqual(["Featured", "Index", "System", "About", "Now"]);
  });

  it("wears the muted TextLink treatment on every nav anchor", () => {
    pathnameMock.mockReturnValue("/");
    render(<NavLinks />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-variant", "muted");
    }
  });

  it("labels the Index 'Index' but points it at /browse (route-name collision guard)", () => {
    pathnameMock.mockReturnValue("/");
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Index" })).toHaveAttribute(
      "href",
      "/browse",
    );
  });

  it("on home, only `Featured` (/) is current — no section false-positive", () => {
    pathnameMock.mockReturnValue("/");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("Featured");
    // Exactly one current item.
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("on /browse, `Index` is current and `Featured` (home) is NOT", () => {
    pathnameMock.mockReturnValue("/browse");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("Index");
    expect(screen.getByRole("link", { name: "Featured" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("lights a section for its descendant route (/system/tokens → system)", () => {
    pathnameMock.mockReturnValue("/system/tokens");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("System");
  });

  it("does NOT light `Index` for a sibling prefix collision (/browse-archive)", () => {
    pathnameMock.mockReturnValue("/browse-archive");
    render(<NavLinks />);
    // No prefix false-positive: /browse-archive is not /browse nor /browse/*.
    expect(screen.getByRole("link", { name: "Index" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(activeLinkName()).toBeNull();
  });

  it("does NOT light `System` for a lexical-prefix sibling (/systematic)", () => {
    pathnameMock.mockReturnValue("/systematic");
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "System" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("matches a section with a trailing slash (/now/ → Now)", () => {
    pathnameMock.mockReturnValue("/now/");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("Now");
  });

  it("does not crash and marks nothing current when usePathname returns null", () => {
    pathnameMock.mockReturnValue(null);
    expect(() => render(<NavLinks />)).not.toThrow();
    expect(activeLinkName()).toBeNull();
  });

  describe("adversarial QA round 2", () => {
    it("every nav anchor wears TextLink's module class, not just data-variant (the ink selector requires both)", () => {
      // The muted ink rules select `.link[data-variant="muted"]…` — if the Slot chain kept the
      // data attribute but dropped the merged className, data-variant alone would pass while
      // the painted ink silently fell back to inherited foreground.
      pathnameMock.mockReturnValue("/browse");
      render(<NavLinks />);
      for (const link of screen.getAllByRole("link")) {
        expect(link).toHaveClass(textLinkStyles.link);
      }
    });
  });
});

/**
 * Guards the nav link's ≥24px pointer target (WCAG 2.2 §2.5.8 Target Size (Minimum)).
 *
 * The bare `.link` text ran ~18px tall — below the 24px floor. The #38 fix gives it a real
 * hit area with `inline-flex` + `min-height`/`min-width` floors + vertical padding. jsdom
 * performs no layout, so a computed-size assertion is impossible here; this pins the
 * declarations that produce the floor at the source (same pragmatic approach as
 * `layout.test.ts`).
 *
 * Both axes are floored MECHANICALLY (`min-height` + `min-width`, not label-dependent), so a
 * future 1–2 char label still clears 24×24. Verifying the real rendered pixel box needs a
 * browser (no Playwright in-repo); the lead's chrome-devtools pass measured it live
 * (Index 39×40, Now 32×40, About 43×40).
 */
describe("NavLinks .link — WCAG 2.5.8 target size floor", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/site-chrome/NavLinks.module.css"),
    "utf8",
  );

  // Isolate the `.link { … }` rule body (not `.link:hover`).
  const linkRule = css.match(/\.link\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  // The floor snaps to `--size-control` (foundation/dimension.css). Resolve its rem value so
  // the guard still proves the box clears 24px, not merely that a token is referenced.
  const dimensionCss = readFileSync(
    resolve(process.cwd(), "src/styles/foundation/dimension.css"),
    "utf8",
  );
  const sizeControlRem = Number(
    dimensionCss.match(/--size-control:\s*([0-9.]+)rem/)?.[1],
  );

  it("finds the .link rule", () => {
    expect(linkRule, "expected a .link {…} rule in the module").not.toBe("");
  });

  it("uses a flex box so min-height + padding define the hit area", () => {
    expect(linkRule).toMatch(/display:\s*inline-flex/);
    expect(linkRule).toMatch(/align-items:\s*center/);
  });

  it("floors the height at 24px via --size-control", () => {
    expect(linkRule).toMatch(/min-height:\s*var\(--size-control\)/);
    // --size-control = 1.5rem = 24px at the 16px root — the 2.5.8 floor.
    expect(sizeControlRem).toBeGreaterThanOrEqual(1.5);
  });

  it("floors the width at 24px via --size-control", () => {
    expect(linkRule).toMatch(/min-width:\s*var\(--size-control\)/);
    // --size-control = 1.5rem = 24px — floors the WIDTH axis mechanically, not via label length.
    expect(sizeControlRem).toBeGreaterThanOrEqual(1.5);
    // centered so a label narrower than the floor sits centered in the 24px box.
    expect(linkRule).toMatch(/justify-content:\s*center/);
  });

  it("grows the pointer target with vertical padding", () => {
    // padding-block (top+bottom) enlarges the target beyond the text line box; the value is
    // the module's --nav-link-pad component token.
    expect(linkRule).toMatch(/padding-block:\s*var\(--nav-link-pad\)/);
  });
});

/**
 * The nav links' type bundle. jsdom computes no custom properties, so the designed values only
 * exist at the source — and the FAMILY binding is the one most likely to be flipped back by
 * accident, since every other chrome face reads `--font-heading`. Pinning it is what makes the
 * mono choice deliberate rather than incidental.
 */
describe("NavLinks component tokens — the type bundle", () => {
  const css = readModuleCss("src/components/site-chrome/NavLinks.module.css");
  const declarations = ruleDeclarations(css, ".links");

  it("binds the links to the UI face — the chrome's grounding sans, never the mono", () => {
    expect(declarations.get("--nav-link-family")).toBe("var(--font-ui)");
  });

  it("declares the rest of the bundle alongside it", () => {
    // The size is a designed chrome value (the geometric mean of type-size-2 and -3): the nav
    // is isolated in chrome with no adjacent editorial type to read against, and the scale's
    // small end steps straight from 13.3px to 16px.
    expect(declarations.get("--nav-link-size")).toBe(
      "clamp(0.9129rem, 0.8924rem + 0.1025vw, 0.9744rem)",
    );
    expect(declarations.get("--nav-link-weight")).toBe(
      "var(--font-weight-medium)",
    );
    expect(declarations.get("--nav-link-tracking")).toBe(
      "var(--tracking-normal)",
    );
    expect(declarations.get("--nav-link-leading")).toBe(
      "var(--leading-normal)",
    );
  });

  it("consumes the family token on the rule that renders the label", () => {
    // Declared on `.links` (the <ul>) and read on `.link` (the anchor) — inheritance carries
    // it, but a consumer that drifted to a non-descendant rule would resolve to nothing.
    expect(ruleDeclarations(css, ".link").get("font-family")).toBe(
      "var(--nav-link-family)",
    );
  });
});
