import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { readModuleCss, ruleDeclarations } from "../../../tests/cssModule";

import Wordmark from "./Wordmark";

describe("Wordmark", () => {
  it("renders the home link with the accessible name 'jamie thompson' (cursor excluded)", () => {
    render(<Wordmark />);
    // The decorative `_` is aria-hidden, so AT hears exactly "jamie thompson" — a cursor
    // leaking into the name would read as "jamie thompson _" on every page.
    const link = screen.getByRole("link", { name: "jamie thompson" });
    expect(link).toHaveAttribute("href", "/");
    // The wordmark is unique chrome with self-owned ink — deliberately NOT a TextLink variant.
    expect(link).not.toHaveAttribute("data-variant");
  });

  it("keeps the blinking-cursor glyph hidden from assistive tech", () => {
    render(<Wordmark />);
    expect(screen.getByText("_")).toHaveAttribute("aria-hidden", "true");
  });
});

/**
 * The wordmark's type moved out of the semantic role sheet into component tokens in this
 * module. Nothing else asserts its designed values, and the intended relationship to the nav
 * links — the wordmark sits exactly ONE step above them on the ramp — spans two modules, so no
 * single-module test can see it drift. jsdom computes no custom properties; pin the source.
 */
describe("Wordmark component tokens — the demoted type bundle", () => {
  const wordmarkCss = readModuleCss(
    "src/components/site-chrome/Wordmark.module.css",
  );
  const navCss = readModuleCss(
    "src/components/site-chrome/NavLinks.module.css",
  );

  it("declares the full type bundle on its own root rule, not the role sheet", () => {
    const declarations = ruleDeclarations(wordmarkCss, ".wordmark");
    expect(declarations.get("--wordmark-family")).toBe("var(--font-heading)");
    expect(declarations.get("--wordmark-size")).toBe("var(--type-size-4)");
    expect(declarations.get("--wordmark-weight")).toBe(
      "var(--font-weight-bold)",
    );
    expect(declarations.get("--wordmark-tracking")).toBe(
      "var(--tracking-tight)",
    );
    expect(declarations.get("--wordmark-leading")).toBe(
      "var(--leading-normal)",
    );
  });

  it("sits exactly one ramp step above the nav links", () => {
    // The masthead hierarchy is the wordmark reading as primary over its own nav. Retuning
    // either module alone silently flattens or inverts that — this is the cross-module pin.
    const step = (value: string | undefined): number =>
      Number(value?.match(/--type-size-(\d+)/)?.[1]);
    const wordmarkStep = step(
      ruleDeclarations(wordmarkCss, ".wordmark").get("--wordmark-size"),
    );
    const navStep = step(
      ruleDeclarations(navCss, ".links").get("--nav-link-size"),
    );
    expect(Number.isNaN(wordmarkStep)).toBe(false);
    expect(Number.isNaN(navStep)).toBe(false);
    expect(wordmarkStep - navStep).toBe(1);
  });

  it("consumes each declared token in the same rule that declares it", () => {
    // The tokens are declared on `.wordmark` and read on `.wordmark` — a consumer that drifted
    // to `.cursor` (a CHILD) would still inherit, but one that drifted to a sibling rule would
    // resolve to nothing. Assert the declare-and-consume pairing explicitly.
    const declarations = ruleDeclarations(wordmarkCss, ".wordmark");
    for (const [property, token] of [
      ["font-family", "--wordmark-family"],
      ["font-size", "--wordmark-size"],
      ["font-weight", "--wordmark-weight"],
      ["letter-spacing", "--wordmark-tracking"],
      ["line-height", "--wordmark-leading"],
    ] as const) {
      expect(declarations.get(property)).toBe(`var(${token})`);
    }
  });
});
