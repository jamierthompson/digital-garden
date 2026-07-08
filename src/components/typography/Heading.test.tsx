import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Heading, { type HeadingLevel, type HeadingVariant } from "./Heading";

const LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6];
const VARIANTS: readonly HeadingVariant[] = [
  "display",
  "title",
  "heading",
  "subheading",
  "body",
  "label",
  "meta",
];

describe("Heading", () => {
  it("renders the matching <hN> element for each level", () => {
    for (const level of LEVELS) {
      const { unmount } = render(
        <Heading level={level}>Section {level}</Heading>,
      );
      // Every level is a real heading in the accessibility tree at that aria level.
      const el = screen.getByRole("heading", {
        level,
        name: `Section ${level}`,
      });
      expect(el.tagName).toBe(`H${level}`);
      unmount();
    }
  });

  it("stamps data-level so the module can size + role-split per level", () => {
    render(<Heading level={3}>Third</Heading>);
    expect(screen.getByRole("heading", { level: 3 })).toHaveAttribute(
      "data-level",
      "3",
    );
  });

  it("sets NO data-variant when variant is omitted (the level default applies)", () => {
    render(<Heading level={2}>Default</Heading>);
    expect(screen.getByRole("heading", { level: 2 })).not.toHaveAttribute(
      "data-variant",
    );
  });

  it("stamps data-variant for each role while keeping the level's element", () => {
    for (const variant of VARIANTS) {
      const { unmount } = render(
        <Heading level={2} variant={variant}>
          {variant}
        </Heading>,
      );
      // The role travels via data-variant; the OUTLINE element stays the level's <h2>.
      const el = screen.getByRole("heading", { level: 2, name: variant });
      expect(el.tagName).toBe("H2");
      expect(el).toHaveAttribute("data-variant", variant);
      expect(el).toHaveAttribute("data-level", "2");
      unmount();
    }
  });

  it("decouples look from outline — an h2 can wear the display role", () => {
    render(
      <Heading level={2} variant="display">
        Kicker
      </Heading>,
    );
    // Still an <h2> in the outline (level 2), just wearing a different role.
    const el = screen.getByRole("heading", { level: 2, name: "Kicker" });
    expect(el.tagName).toBe("H2");
    expect(el).toHaveAttribute("data-variant", "display");
  });

  it("merges a caller className alongside its own", () => {
    render(
      <Heading level={2} className="caller">
        Titled
      </Heading>,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveClass("caller");
  });

  it("merges a caller className with no stray 'undefined' when className is omitted", () => {
    const { container } = render(<Heading level={1}>Hero</Heading>);
    const className = container.firstElementChild?.className ?? "";
    expect(className).not.toContain("undefined");
    expect(className.trim().length).toBeGreaterThan(0);
  });

  it("forwards native, aria, and data-* attributes onto the element", () => {
    render(
      <Heading level={2} id="sec" aria-describedby="hint" data-foo="bar">
        Titled
      </Heading>,
    );
    const el = screen.getByRole("heading", { level: 2 });
    expect(el).toHaveAttribute("id", "sec");
    expect(el).toHaveAttribute("aria-describedby", "hint");
    expect(el).toHaveAttribute("data-foo", "bar");
  });

  it("passes a caller style through unchanged", () => {
    render(
      <Heading level={2} style={{ color: "red" }}>
        Titled
      </Heading>,
    );
    expect(screen.getByRole("heading", { level: 2 }).style.color).toBe("red");
  });

  // A type primitive must be reachable by ref (measuring / animating / View Transitions). The
  // prop type extends ComponentPropsWithRef<"h1">, so the ref forwards through the ...rest spread.
  it("forwards a ref to the underlying heading element", () => {
    const ref = createRef<HTMLHeadingElement>();
    render(
      <Heading level={4} ref={ref}>
        Reffed
      </Heading>,
    );
    expect(ref.current).toBe(screen.getByRole("heading", { level: 4 }));
    expect(ref.current?.tagName).toBe("H4");
  });

  it("renders the child element instead of an <hN> under asChild, merging class + data-level", () => {
    render(
      <Heading level={2} asChild className="caller">
        <a href="#x">Linked heading</a>
      </Heading>,
    );
    const el = screen.getByRole("link", { name: "Linked heading" });
    expect(el.tagName).toBe("A");
    expect(el).toHaveAttribute("data-level", "2");
    expect(el).toHaveClass("caller");
  });

  it("routes a Heading ref to the child under asChild", () => {
    const ref = createRef<HTMLHeadingElement>();
    render(
      <Heading level={2} asChild ref={ref}>
        <a href="#x">Linked</a>
      </Heading>,
    );
    expect(ref.current).toBe(screen.getByRole("link", { name: "Linked" }));
    expect(ref.current?.tagName).toBe("A");
  });

  it("fails LOUDLY when asChild receives multiple children (no silent swallow)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Heading level={2} asChild>
          <span>a</span>
          <span>b</span>
        </Heading>,
      ),
    ).toThrow(/single React element child/i);
    spy.mockRestore();
  });

  it("fails LOUDLY when asChild receives a lone non-element child (plain text)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Heading level={2} asChild>
          just text
        </Heading>,
      ),
    ).toThrow(/single React element child/i);
    spy.mockRestore();
  });

  it("keeps heading semantics when asChild slots a real heading element", () => {
    // The a11y-correct asChild usage: the child IS a heading, so the document outline keeps
    // the level while the primitive contributes only the type role. (An asChild onto a
    // non-heading child — e.g. the docstring's <a> — renders NO heading in the outline;
    // that responsibility sits with the caller.)
    render(
      <Heading level={2} asChild>
        <h2 className="childs-own">Slotted section</h2>
      </Heading>,
    );
    const el = screen.getByRole("heading", {
      level: 2,
      name: "Slotted section",
    });
    expect(el).toHaveAttribute("data-level", "2");
    expect(el).toHaveClass("childs-own");
  });

  it("preserves the slotted child's OWN className alongside the primitive's + the caller's", () => {
    render(
      <Heading level={3} asChild className="caller">
        <a className="childs-own" href="#x">
          Linked
        </a>
      </Heading>,
    );
    const el = screen.getByRole("link", { name: "Linked" });
    expect(el).toHaveClass("childs-own");
    expect(el).toHaveClass("caller");
    expect(el.className).not.toContain("undefined");
  });

  it("merges the caller style with the slotted child's own style under asChild", () => {
    render(
      <Heading level={2} asChild style={{ color: "red" }}>
        <a href="#x" style={{ marginTop: "1px" }}>
          Styled
        </a>
      </Heading>,
    );
    const el = screen.getByRole("link", { name: "Styled" });
    expect(el.style.color).toBe("red");
    expect(el.style.marginTop).toBe("1px");
  });
});
