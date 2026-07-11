import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { space } from "@/lib/tokens";

import Grid from "./Grid";

describe("Grid", () => {
  it("renders a <div> wrapping its children by default", () => {
    render(
      <Grid min="20rem" gap={space(5)} data-testid="grid">
        <span>a</span>
        <span>b</span>
      </Grid>,
    );
    const el = screen.getByTestId("grid");
    expect(el.tagName).toBe("DIV");
    expect(el).toContainElement(screen.getByText("a"));
    expect(el).toContainElement(screen.getByText("b"));
  });

  it("passes both props through the --grid-min / --grid-gap conduits", () => {
    render(<Grid min="20rem" gap={space(5)} data-testid="grid" />);
    const el = screen.getByTestId("grid");
    expect(el.style.getPropertyValue("--grid-min")).toBe("20rem");
    expect(el.style.getPropertyValue("--grid-gap")).toBe("var(--space-5)");
  });

  it("merges a caller className alongside its own", () => {
    render(
      <Grid min="20rem" gap={space(5)} className="caller" data-testid="grid" />,
    );
    // Own (hashed) class is present too; toHaveClass matches within the merged list.
    expect(screen.getByTestId("grid")).toHaveClass("caller");
  });

  it("lets a caller style override the tokens (escape hatch: caller wins)", () => {
    render(
      <Grid
        min="20rem"
        gap={space(5)}
        style={
          {
            "--grid-min": "30rem",
            "--grid-gap": space(2),
          } as React.CSSProperties
        }
        data-testid="grid"
      />,
    );
    const el = screen.getByTestId("grid");
    expect(el.style.getPropertyValue("--grid-min")).toBe("30rem");
    expect(el.style.getPropertyValue("--grid-gap")).toBe("var(--space-2)");
  });

  it("renders the child element instead of a <div> when asChild, merging the tokens onto it", () => {
    render(
      <Grid asChild min="20rem" gap={space(5)} data-testid="grid">
        <ul>
          <li>only child</li>
        </ul>
      </Grid>,
    );
    const el = screen.getByTestId("grid");
    expect(el.tagName).toBe("UL");
    expect(el.style.getPropertyValue("--grid-min")).toBe("20rem");
    expect(el.style.getPropertyValue("--grid-gap")).toBe("var(--space-5)");
  });

  // --- Boundary: the conduit writes exactly what it's given (no truthiness gate) ---

  // Unlike Stack's optional gap, Grid's props are required and always written — there is no
  // `? … : null` gate, so even a literal zero passes straight through as a real length.
  it("writes a literal zero gap through the conduit unchanged", () => {
    render(<Grid min="20rem" gap="0" data-testid="grid" />);
    expect(
      screen.getByTestId("grid").style.getPropertyValue("--grid-gap"),
    ).toBe("0");
  });

  it("passes an engine-style clamp() value straight through the conduit unchanged", () => {
    render(
      <Grid min="20rem" gap="clamp(1rem, 2vw, 2rem)" data-testid="grid" />,
    );
    expect(
      screen.getByTestId("grid").style.getPropertyValue("--grid-gap"),
    ).toBe("clamp(1rem, 2vw, 2rem)");
  });

  it("passes a raw min length (not a token) straight through the conduit unchanged", () => {
    render(<Grid min="18rem" gap={space(5)} data-testid="grid" />);
    expect(
      screen.getByTestId("grid").style.getPropertyValue("--grid-min"),
    ).toBe("18rem");
  });

  // --- Contract: native attribute + ref forwarding ---

  it("forwards native, aria, role and data-* attributes onto the element", () => {
    render(
      <Grid
        min="20rem"
        gap={space(5)}
        data-testid="grid"
        role="list"
        aria-label="entries"
        data-foo="bar"
      />,
    );
    const el = screen.getByTestId("grid");
    expect(el).toHaveAttribute("role", "list");
    expect(el).toHaveAttribute("aria-label", "entries");
    expect(el).toHaveAttribute("data-foo", "bar");
  });

  // A layout primitive must be reachable by ref so it can be measured / scrolled-to / observed.
  // The prop type extends `ComponentPropsWithRef<"div">`, so `<Grid ref>` type-checks, and the
  // `...rest` spread forwards the ref onto the real element.
  it("forwards a ref to the underlying div", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Grid ref={ref} min="20rem" gap={space(5)} data-testid="grid" />);
    expect(ref.current).toBe(screen.getByTestId("grid"));
    expect(ref.current?.tagName).toBe("DIV");
  });

  // Under `asChild`, Radix `Slot` routes a ref put on `<Grid>` to the rendered child AND preserves
  // the child's own ref instead of clobbering it — both resolve to the same child element. The Grid
  // ref stays typed `HTMLDivElement` even though it lands on the `<ul>` at runtime, matching how
  // Radix's own primitives type `asChild`.
  it("routes a Grid ref to the child under asChild without clobbering the child's own ref", () => {
    const gridRef = createRef<HTMLDivElement>();
    const childRef = createRef<HTMLUListElement>();
    render(
      <Grid asChild min="20rem" gap={space(5)} ref={gridRef}>
        <ul ref={childRef} data-testid="grid">
          <li>only child</li>
        </ul>
      </Grid>,
    );
    const child = screen.getByTestId("grid");
    expect(gridRef.current).toBe(child);
    expect(childRef.current).toBe(child);
    expect(child.tagName).toBe("UL");
  });

  it("merges a caller className with no stray 'undefined' when className is omitted", () => {
    const { container } = render(
      <Grid min="20rem" gap={space(5)} data-testid="grid" />,
    );
    // Only the hashed own-class should be present — the filter(Boolean) must drop the undefined
    // className so the class list never contains the string "undefined".
    expect(container.firstElementChild?.className).not.toContain("undefined");
    expect(
      container.firstElementChild?.className.trim().length,
    ).toBeGreaterThan(0);
  });

  it("merges non-token caller style props alongside the tokens (all survive)", () => {
    render(
      <Grid
        min="20rem"
        gap={space(5)}
        style={{ color: "red" }}
        data-testid="grid"
      />,
    );
    const el = screen.getByTestId("grid");
    expect(el.style.getPropertyValue("--grid-min")).toBe("20rem");
    expect(el.style.getPropertyValue("--grid-gap")).toBe("var(--space-5)");
    expect(el.style.color).toBe("red");
  });

  // --- Error path: Radix Slot's single-child contract (asChild) ---

  it("forwards data-* onto the slotted child element under asChild", () => {
    render(
      <Grid
        asChild
        min="20rem"
        gap={space(5)}
        data-foo="bar"
        data-testid="grid"
      >
        <section>content</section>
      </Grid>,
    );
    const el = screen.getByTestId("grid");
    expect(el.tagName).toBe("SECTION");
    expect(el).toHaveAttribute("data-foo", "bar");
  });

  it("fails LOUDLY when asChild receives multiple children (no silent swallow)", () => {
    // Radix Slot requires exactly one element child; more than one throws rather than dropping
    // the extras silently. Pin that the failure is loud so a misuse can't ship a broken layout.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Grid asChild min="20rem" gap={space(5)}>
          <span>a</span>
          <span>b</span>
        </Grid>,
      ),
    ).toThrow(/single React element child/i);
    spy.mockRestore();
  });

  // Radix Slot renders nothing (not an error) when asChild gets NO child — the complement to the
  // multiple-children throw above. Pins that the misuse degrades to an empty render, not a crash.
  it("renders nothing without throwing when asChild receives no child", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<Grid asChild min="20rem" gap={space(5)} />);
    expect(container).toBeEmptyDOMElement();
    spy.mockRestore();
  });

  // --- Boundary: empty-string props are the silent-breakage edge ---

  // The props are required `string`s with no truthiness gate, so `min=""` writes a *guaranteed-
  // invalid* custom-property value: React/jsdom drops the declaration entirely (`--grid-min` is
  // absent from the style, only `--grid-gap` remains). In a real browser `var(--grid-min)` then
  // has no value and no fallback, so `grid-template-columns` becomes invalid and falls back to
  // `none` — the grid silently collapses to a single stacked column. This pins that behavior: an
  // empty floor is caller misuse the primitive does NOT guard (consistent with Stack/Page trusting
  // callers to pass real CSS), so the floor must always be a real length.
  it("drops the --grid-min declaration when min is an empty string (silent-breakage boundary)", () => {
    render(<Grid min="" gap={space(5)} data-testid="grid" />);
    const el = screen.getByTestId("grid");
    expect(el.style.getPropertyValue("--grid-min")).toBe("");
    expect(el.getAttribute("style")).not.toContain("--grid-min");
    // The other conduit is unaffected — the drop is per-property, not all-or-nothing.
    expect(el.style.getPropertyValue("--grid-gap")).toBe("var(--space-5)");
  });

  it("drops the --grid-gap declaration when gap is an empty string (silent-breakage boundary)", () => {
    render(<Grid min="20rem" gap="" data-testid="grid" />);
    const el = screen.getByTestId("grid");
    expect(el.style.getPropertyValue("--grid-gap")).toBe("");
    expect(el.getAttribute("style")).not.toContain("--grid-gap");
    expect(el.style.getPropertyValue("--grid-min")).toBe("20rem");
  });

  // Overriding ONE conduit via the caller `style` must not disturb the other — the merge is a
  // per-property spread, not a wholesale replacement. Complements the "caller wins" test, which
  // overrides both at once and so wouldn't catch an all-or-nothing merge bug.
  it("preserves the un-overridden conduit when a caller style overrides only the other", () => {
    render(
      <Grid
        min="20rem"
        gap={space(5)}
        style={{ "--grid-gap": space(2) } as React.CSSProperties}
        data-testid="grid"
      />,
    );
    const el = screen.getByTestId("grid");
    expect(el.style.getPropertyValue("--grid-gap")).toBe("var(--space-2)");
    expect(el.style.getPropertyValue("--grid-min")).toBe("20rem");
  });
});
