import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { readModuleCss, ruleDeclarations } from "../../../tests/cssModule";

import Logo from "./Logo";

const Mark = (): React.ReactElement => (
  <svg viewBox="0 0 24 24" fill="currentColor" data-testid="mark">
    <circle cx="12" cy="12" r="6" />
  </svg>
);

describe("Logo", () => {
  it("is the home link, named for the site", () => {
    render(
      <Logo>
        <Mark />
      </Logo>,
    );
    const link = screen.getByRole("link", { name: "jamie thompson" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("hides the mark from assistive tech whatever SVG it is given", () => {
    // The name lives on the link, so a mark that reached the a11y tree would announce the
    // identity twice. The wrapper enforces this for ANY child — the caller can't get it wrong.
    render(
      <Logo>
        <Mark />
      </Logo>,
    );
    const mark = screen.getByTestId("mark");
    expect(mark.closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByRole("link").textContent).toBe("");
  });

  it("exposes exactly one link", () => {
    render(
      <Logo>
        <Mark />
      </Logo>,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  describe("the any-SVG contract under hostile marks", () => {
    it("keeps the link's name even when the mark carries its own role and label", () => {
      // A designed mark exported from a tool often arrives with `role="img"` + a label baked
      // in. The wrapper must silence it: otherwise the a11y tree grows a second, wrong name.
      render(
        <Logo>
          <svg role="img" aria-label="rogue brand" viewBox="0 0 24 24" />
        </Logo>,
      );
      expect(screen.queryByRole("img")).toBeNull();
      expect(
        screen.getByRole("link", { name: "jamie thompson" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /rogue/i })).toBeNull();
    });

    it("keeps the link's name when the mark leaks text content", () => {
      // `aria-label` on the link must beat any child text in the accessible-name computation,
      // so a mark with stray <text>/tspans can't rename the home link.
      render(
        <Logo>
          <svg viewBox="0 0 24 24">
            <text>stray label</text>
          </svg>
        </Logo>,
      );
      expect(
        screen.getByRole("link", { name: "jamie thompson" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /stray/i })).toBeNull();
    });

    it("hides every child of a multi-node mark behind the one decorative wrapper", () => {
      render(
        <Logo>
          <svg viewBox="0 0 24 24" data-testid="first" />
          <svg viewBox="0 0 24 24" data-testid="second" />
        </Logo>,
      );
      expect(screen.getAllByRole("link")).toHaveLength(1);
      for (const id of ["first", "second"]) {
        expect(
          screen.getByTestId(id).closest("[aria-hidden='true']"),
        ).not.toBeNull();
      }
    });
  });
});

/**
 * jsdom loads no stylesheets and computes no custom properties, so the logo's designed values
 * and — critically — its interactive states can only be pinned at the source. A state rule
 * silently deleted in a retune has no runtime symptom any other test in this directory can see.
 */
describe("Logo component tokens and states", () => {
  const css = readModuleCss("src/components/site-chrome/Logo.module.css");

  it("declares its designed tokens on its own root rule", () => {
    const declarations = ruleDeclarations(css, ".logo");
    expect(declarations.get("--logo-size")).toBe("var(--size-control-lg)");
    // The mark is a GRAPHIC, so it wears the neutral graphic ink — the same treatment as every
    // other icon in the chrome — never a 4.5-solved text role. `pnpm lint:icon` enforces this
    // repo-wide; the assertion pins THIS component's designed pair.
    expect(declarations.get("--logo-ink")).toBe("var(--icon)");
    expect(declarations.get("--logo-ink-hover")).toBe("var(--foreground)");
    expect(declarations.get("--logo-radius")).toBe("var(--radius-control)");
    expect(declarations.get("--logo-press-scale")).toBe("0.94");
    expect(declarations.get("--logo-duration")).toBe("var(--duration-fast)");
    expect(declarations.get("--logo-ease")).toBe("var(--ease-standard)");
  });

  it("floors the pointer target at 24×24 on BOTH axes", () => {
    // WCAG 2.2 SC 2.5.8 Target Size (Minimum): https://www.w3.org/TR/WCAG22/#target-size-minimum
    // A mark smaller than --logo-size must still clear the floor, so the floor is mechanical
    // rather than a consequence of the mark's size.
    const declarations = ruleDeclarations(css, ".logo");
    expect(declarations.get("min-inline-size")).toBe("var(--size-control)");
    expect(declarations.get("min-block-size")).toBe("var(--size-control)");
  });

  it("wears its rest ink and consumes each declared token in the rule that declares it", () => {
    const declarations = ruleDeclarations(css, ".logo");
    expect(declarations.get("color")).toBe("var(--logo-ink)");
    expect(declarations.get("border-radius")).toBe("var(--logo-radius)");
    expect(declarations.get("transition")).toContain("var(--logo-duration)");
    expect(declarations.get("transition")).toContain("var(--logo-ease)");
  });

  it("transitions BOTH state channels — the ink change and the press transform", () => {
    // The states move exactly two properties (color on hover/press, transform on press);
    // dropping either from the transition list makes that state snap instead of ease.
    const transition = ruleDeclarations(css, ".logo").get("transition") ?? "";
    expect(transition).toMatch(/(^|[\s,])color[\s,]/);
    expect(transition).toMatch(/(^|[\s,])transform[\s,]/);
  });

  it("sizes the mark from --logo-size, so an SVG needs no width/height attributes", () => {
    const declarations = ruleDeclarations(css, ".mark svg");
    expect(declarations.get("inline-size")).toBe("var(--logo-size)");
    expect(declarations.get("block-size")).toBe("var(--logo-size)");
  });

  it("styles hover", () => {
    expect(ruleDeclarations(css, ".logo:hover").get("color")).toBe(
      "var(--logo-ink-hover)",
    );
  });

  it("styles focus-visible with the site ring tokens — never bare :focus", () => {
    const focusVisible = ruleDeclarations(css, ".logo:focus-visible");
    expect(focusVisible.get("outline")).toBe(
      "var(--ring-width) var(--ring-style) var(--ring)",
    );
    expect(focusVisible.get("outline-offset")).toBe("var(--ring-offset)");
    // A bare `:focus` ring fires on mouse press too — the repo styles `:focus-visible` only.
    expect(ruleDeclarations(css, ".logo:focus").size).toBe(0);
  });

  it("styles the press with the ink and a scale transform", () => {
    const active = ruleDeclarations(css, ".logo:active");
    expect(active.get("color")).toBe("var(--logo-ink-hover)");
    expect(active.get("transform")).toBe("scale(var(--logo-press-scale))");
  });
});
