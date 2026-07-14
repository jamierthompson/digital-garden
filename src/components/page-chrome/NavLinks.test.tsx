import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("NavLinks — the journal masthead current-page indicator", () => {
  it("renders every IA destination as a link with its journal-lowercase label", () => {
    pathnameMock.mockReturnValue("/");
    render(<NavLinks />);
    const labels = screen.getAllByRole("link").map((a) => a.textContent);
    expect(labels).toEqual(["featured", "index", "system", "about", "now"]);
  });

  it("labels the Index 'index' but points it at /browse (route-name collision guard)", () => {
    pathnameMock.mockReturnValue("/");
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "index" })).toHaveAttribute(
      "href",
      "/browse",
    );
  });

  it("on home, only `featured` (/) is current — no section false-positive", () => {
    pathnameMock.mockReturnValue("/");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("featured");
    // Exactly one current item.
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("on /browse, `index` is current and `featured` (home) is NOT", () => {
    pathnameMock.mockReturnValue("/browse");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("index");
    expect(screen.getByRole("link", { name: "featured" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("lights a section for its descendant route (/system/tokens → system)", () => {
    pathnameMock.mockReturnValue("/system/tokens");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("system");
  });

  it("does NOT light `index` for a sibling prefix collision (/browse-archive)", () => {
    pathnameMock.mockReturnValue("/browse-archive");
    render(<NavLinks />);
    // No prefix false-positive: /browse-archive is not /browse nor /browse/*.
    expect(screen.getByRole("link", { name: "index" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(activeLinkName()).toBeNull();
  });

  it("does NOT light `system` for a lexical-prefix sibling (/systematic)", () => {
    pathnameMock.mockReturnValue("/systematic");
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "system" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("matches a section with a trailing slash (/now/ → now)", () => {
    pathnameMock.mockReturnValue("/now/");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("now");
  });

  it("does not crash and marks nothing current when usePathname returns null", () => {
    pathnameMock.mockReturnValue(null);
    expect(() => render(<NavLinks />)).not.toThrow();
    expect(activeLinkName()).toBeNull();
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
    resolve(process.cwd(), "src/components/page-chrome/NavLinks.module.css"),
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
    // padding-block (top+bottom) enlarges the target beyond the text line box.
    expect(linkRule).toMatch(/padding-block:\s*var\(--space-2\)/);
  });
});
