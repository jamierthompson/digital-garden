import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Logo from "./Logo";
import MobileNav from "./MobileNav";
import SiteNav from "./SiteNav";
import TulipMark from "./TulipMark";

// SiteNav/MobileNav mount the `NavLinks` client leaf, which reads `usePathname`.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/site-chrome/TulipMark.tsx"),
  "utf8",
);

/**
 * The designed mark shipped with no test file of its own. These pin the contract its two
 * consumers (`SiteNav`, `MobileNav`) and its module (`Logo.module.css`) silently depend on:
 * one `currentColor`-painting, attribute-sizeless, id-free SVG — every one of which a
 * re-export from a design tool routinely breaks.
 */
describe("TulipMark — the mark's contract", () => {
  it("renders exactly one svg on a 24-unit viewBox", () => {
    const { container } = render(<TulipMark />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("carries NO width/height attributes, so --logo-size governs the size", () => {
    // `Logo.module.css` sizes the mark via `.mark svg { inline-size: var(--logo-size) }`.
    // A width/height attribute pair from an export would still lose to CSS, but a
    // width-only export changes the aspect ratio the viewBox is meant to own.
    const { container } = render(<TulipMark />);
    const svg = container.querySelector("svg")!;
    expect(svg.hasAttribute("width")).toBe(false);
    expect(svg.hasAttribute("height")).toBe(false);
  });

  it("paints only currentColor — no baked literal ink can escape the ink tokens", () => {
    // The whole `--logo-ink` / `--logo-ink-hover` state machine is an inherited `color`
    // change. One `fill="#e83e8c"` from a design-tool export silently freezes the mark at a
    // single colour in both schemes and every page theme, with no test, lint or build symptom.
    const { container } = render(<TulipMark />);
    const markup = container.innerHTML;
    expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(markup).not.toMatch(/\b(rgba?|hsla?|oklch|oklab|color)\(/i);
    for (const attr of ["fill", "stroke"]) {
      for (const el of container.querySelectorAll(`[${attr}]`)) {
        expect(["currentColor", "none"]).toContain(el.getAttribute(attr));
      }
    }
  });

  it("declares no id / url() reference, so the two simultaneous mounts cannot collide", () => {
    // SiteNav renders the inline band AND MobileNav's bar: both presentations are in the DOM
    // at once (CSS picks between them), so the mark is mounted TWICE on every page. A
    // `<linearGradient id="a">` or `<clipPath id="a">` from an export would duplicate the id
    // — invalid markup, and `url(#a)` resolves to whichever one parsed first.
    const { container } = render(
      <>
        <TulipMark />
        <TulipMark />
      </>,
    );
    expect(container.querySelectorAll("[id]")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/url\(#/);
    expect(SOURCE).not.toMatch(/\sid=/);
  });

  it("stays inert to assistive tech when Logo wraps it", () => {
    render(<Logo>{<TulipMark />}</Logo>);
    const link = screen.getByRole("link", { name: "jamie thompson" });
    expect(link.textContent).toBe("");
    expect(screen.queryByRole("img")).toBeNull();
    expect(
      link.querySelector("svg")!.closest("[aria-hidden='true']"),
    ).not.toBeNull();
  });
});

/**
 * The mount sites. Every existing SiteNav/MobileNav assertion is about the LINK — so
 * `<Logo>{null}</Logo>` (the exact shape a bad merge of the placeholder removal produces)
 * passes the whole suite while the header renders a blank 40px gap.
 */
describe("the mark is actually mounted in the chrome", () => {
  it("SiteNav's logo link contains a mark", () => {
    render(<SiteNav />);
    const logos = screen.getAllByRole("link", { name: "jamie thompson" });
    expect(logos.length).toBeGreaterThan(0);
    for (const logo of logos) {
      expect(logo.querySelector("svg")).not.toBeNull();
    }
  });

  it("MobileNav's panel bar contains a mark", () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    const panel = screen.getByRole("dialog");
    const logo = within(panel).getByRole("link", { name: "jamie thompson" });
    expect(logo.querySelector("svg")).not.toBeNull();
  });
});
