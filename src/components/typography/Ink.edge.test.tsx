import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import Ink from "./Ink";
import { TEXT_COLORS } from "./textColor";

/**
 * Adversarial edges for the `Ink` primitive (QA, independent of the authoring slice).
 *
 * The author's own suite pins the happy shape (span + data-color + a class) on three roles.
 * These pin the CONTRACT the props claim: that every dispatcher role is reachable, that
 * `ComponentPropsWithRef<"span">` is honoured at runtime and not merely typed, that the
 * class-merge can't emit a junk token, and — the accessibility claim in the component's own
 * doc comment — that color-only emphasis really is invisible to assistive tech.
 */
describe("Ink — every dispatcher role is reachable", () => {
  // The module test pins prop ⇄ CSS. This pins prop ⇄ COMPONENT: a role added to TEXT_COLORS
  // that `Ink` cannot actually render (a narrowed union, a stale import) goes red here.
  for (const color of TEXT_COLORS) {
    it(`renders the "${color}" role onto data-color, verbatim`, () => {
      render(<Ink color={color}>run</Ink>);
      const run = screen.getByText("run");
      expect(run).toHaveAttribute("data-color", color);
      expect(run.tagName).toBe("SPAN");
    });
  }

  it("covers all ten roles — the widened contract, not the original three", () => {
    // Guards the slice's stated intent (3 → 10 roles) against a silent narrowing.
    expect(TEXT_COLORS).toHaveLength(10);
    expect(TEXT_COLORS.filter((c) => c.startsWith("harmony-"))).toHaveLength(7);
  });
});

describe("Ink — prop contract vs. runtime", () => {
  it("honours the `ref` its props type advertises (React 19 ref-as-prop)", () => {
    // `InkProps extends ComponentPropsWithRef<"span">` is a PROMISE to callers. `Ink` is a
    // plain function component with no `forwardRef`, so this only works because React 19
    // passes `ref` as a normal prop into `rest`. Pin it: a regression to a React 18-style
    // component (or destructuring `ref` away) would silently drop every caller's ref.
    const ref = createRef<HTMLSpanElement>();
    render(
      <Ink color="foreground" ref={ref}>
        anchored
      </Ink>,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("SPAN");
    expect(ref.current?.textContent).toBe("anchored");
  });

  it("emits no empty/undefined class token when className is omitted", () => {
    // `[styles.ink, className].filter(Boolean).join(" ")` — a regression to a bare `join`
    // would emit `"_ink_x "` or `"_ink_x undefined"`, both of which break exact-class asserts
    // and CSS-in-JS consumers downstream.
    render(<Ink color="foreground">solo</Ink>);
    const cls = screen.getByText("solo").getAttribute("class") ?? "";
    expect(cls.split(" ").filter((t) => t === "" || t === "undefined")).toEqual(
      [],
    );
    expect(cls.trim()).toBe(cls);
  });

  it("keeps the ink class when an empty-string className is passed", () => {
    render(
      <Ink color="foreground" className="">
        blank
      </Ink>,
    );
    const cls = screen.getByText("blank").getAttribute("class") ?? "";
    expect(cls).not.toBe("");
    expect(cls.split(" ")).not.toContain("");
  });

  it("passes arbitrary span attributes through without swallowing them", () => {
    render(
      <Ink color="foreground" id="phrase" lang="fr" title="tip">
        passthrough
      </Ink>,
    );
    const run = screen.getByText("passthrough");
    expect(run).toHaveAttribute("id", "phrase");
    expect(run).toHaveAttribute("lang", "fr");
    expect(run).toHaveAttribute("title", "tip");
  });

  it("renders an empty span for absent children without throwing", () => {
    const { container } = render(<Ink color="foreground" />);
    const run = container.querySelector("span[data-color='foreground']");
    expect(run).not.toBeNull();
    expect(run?.textContent).toBe("");
  });

  it("nests — an inner run wears its own role, not the outer one", () => {
    render(
      <Ink color="foreground">
        outer <Ink color="accent-text">inner</Ink>
      </Ink>,
    );
    expect(screen.getByText("inner")).toHaveAttribute(
      "data-color",
      "accent-text",
    );
  });
});

describe("Ink — the accessibility claim in its doc comment", () => {
  it("adds no semantic emphasis: no role, no em/i/strong element", () => {
    // The component comment asserts color-only emphasis is "deliberately invisible to
    // assistive tech". Verify the claim rather than trusting it.
    const { container } = render(
      <p>
        plain <Ink color="accent-text">colored</Ink> plain
      </p>,
    );
    const run = screen.getByText("colored");
    expect(run).not.toHaveAttribute("role");
    expect(container.querySelectorAll("em, i, strong, b")).toHaveLength(0);
  });

  it("leaves the host heading's accessible name and text intact", () => {
    // An Ink run inside a heading must not fragment the accessible name — the screen-reader
    // announcement has to read as one uninterrupted sentence.
    render(
      <h1>
        Notes, essays, and{" "}
        <Ink color="accent-text">things I&rsquo;m building</Ink> in the open.
      </h1>,
    );
    const h1 = screen.getByRole("heading", {
      level: 1,
      name: "Notes, essays, and things I’m building in the open.",
    });
    expect(h1.textContent).toBe(
      "Notes, essays, and things I’m building in the open.",
    );
  });
});
