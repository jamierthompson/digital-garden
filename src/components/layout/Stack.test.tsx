import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { space } from "@/lib/tokens";

import Stack from "./Stack";

describe("Stack", () => {
  it("renders a <div> wrapping its children by default", () => {
    render(
      <Stack data-testid="stack">
        <span>a</span>
        <span>b</span>
      </Stack>,
    );
    const el = screen.getByTestId("stack");
    expect(el.tagName).toBe("DIV");
    expect(el).toContainElement(screen.getByText("a"));
    expect(el).toContainElement(screen.getByText("b"));
  });

  it("passes the gap token through the --stack-gap custom property (the conduit)", () => {
    render(<Stack gap={space(6)} data-testid="stack" />);
    expect(
      screen.getByTestId("stack").style.getPropertyValue("--stack-gap"),
    ).toBe("var(--space-6)");
  });

  it("sets no --stack-gap when gap is omitted (CSS default applies)", () => {
    render(<Stack data-testid="stack" />);
    expect(
      screen.getByTestId("stack").style.getPropertyValue("--stack-gap"),
    ).toBe("");
  });

  it("merges a caller className alongside its own", () => {
    render(<Stack className="caller" data-testid="stack" />);
    // Own (hashed) class is present too; toHaveClass matches within the merged list.
    expect(screen.getByTestId("stack")).toHaveClass("caller");
  });

  it("lets a caller style override the token (escape hatch: caller wins)", () => {
    render(
      <Stack
        gap={space(6)}
        style={{ "--stack-gap": space(2) } as React.CSSProperties}
        data-testid="stack"
      />,
    );
    expect(
      screen.getByTestId("stack").style.getPropertyValue("--stack-gap"),
    ).toBe("var(--space-2)");
  });

  it("renders the child element instead of a <div> when asChild, merging the gap onto it", () => {
    render(
      <Stack asChild gap={space(5)} data-testid="stack">
        <ul>
          <li>only child</li>
        </ul>
      </Stack>,
    );
    const el = screen.getByTestId("stack");
    expect(el.tagName).toBe("UL");
    expect(el.style.getPropertyValue("--stack-gap")).toBe("var(--space-5)");
  });

  // --- Boundary: the gap conduit's truthiness gate ---

  it("falls back to the CSS default when gap is an empty string (writes no --stack-gap)", () => {
    // `gap ? … : null` treats "" as falsy, so the conduit writes nothing and the CSS default
    // (var(--stack-gap, var(--space-stack))) applies — a broken `--stack-gap:` is never emitted.
    render(<Stack gap="" data-testid="stack" />);
    expect(
      screen.getByTestId("stack").style.getPropertyValue("--stack-gap"),
    ).toBe("");
  });

  it("writes a literal zero gap through the conduit (gap='0' is a real length, not a fallback)", () => {
    render(<Stack gap="0" data-testid="stack" />);
    expect(
      screen.getByTestId("stack").style.getPropertyValue("--stack-gap"),
    ).toBe("0");
  });

  it("passes an engine-style clamp() value straight through the conduit unchanged", () => {
    render(<Stack gap="clamp(1rem, 2vw, 2rem)" data-testid="stack" />);
    expect(
      screen.getByTestId("stack").style.getPropertyValue("--stack-gap"),
    ).toBe("clamp(1rem, 2vw, 2rem)");
  });

  // --- Contract: native attribute + ref forwarding ---

  it("forwards native, aria, role and data-* attributes onto the element", () => {
    render(
      <Stack
        data-testid="stack"
        role="list"
        aria-label="updates"
        data-foo="bar"
      />,
    );
    const el = screen.getByTestId("stack");
    expect(el).toHaveAttribute("role", "list");
    expect(el).toHaveAttribute("aria-label", "updates");
    expect(el).toHaveAttribute("data-foo", "bar");
  });

  // A layout primitive must be reachable by ref so it can be measured / scrolled-to / observed
  // (e.g. for View-Transition work). The prop type extends `ComponentPropsWithRef<"div">`, so
  // `<Stack ref>` type-checks, and the `...rest` spread forwards the ref onto the real element.
  it("forwards a ref to the underlying div", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Stack ref={ref} data-testid="stack" />);
    expect(ref.current).toBe(screen.getByTestId("stack"));
    expect(ref.current?.tagName).toBe("DIV");
  });

  // Under `asChild`, Radix `Slot` routes a ref put on `<Stack>` to the rendered child (the direct
  // analog of the widened type), AND preserves the child's own ref instead of clobbering it — both
  // resolve to the same child element. Note the Stack ref stays typed `HTMLDivElement` (Stack's
  // declared element) even though it lands on the `<ul>` at runtime; `asChild` can't narrow the
  // ref's element type, matching how Radix's own primitives type `asChild`.
  it("routes a Stack ref to the child under asChild without clobbering the child's own ref", () => {
    const stackRef = createRef<HTMLDivElement>();
    const childRef = createRef<HTMLUListElement>();
    render(
      <Stack asChild ref={stackRef}>
        <ul ref={childRef} data-testid="stack">
          <li>only child</li>
        </ul>
      </Stack>,
    );
    const child = screen.getByTestId("stack");
    expect(stackRef.current).toBe(child);
    expect(childRef.current).toBe(child);
    expect(child.tagName).toBe("UL");
  });

  it("merges a caller className with no stray 'undefined' when className is omitted", () => {
    const { container } = render(<Stack data-testid="stack" />);
    // Only the hashed own-class should be present — the filter(Boolean) must drop the undefined
    // className so the class list never contains the string "undefined".
    expect(container.firstElementChild?.className).not.toContain("undefined");
    expect(
      container.firstElementChild?.className.trim().length,
    ).toBeGreaterThan(0);
  });

  it("merges non-gap caller style props alongside the token (both survive)", () => {
    render(
      <Stack gap={space(6)} style={{ color: "red" }} data-testid="stack" />,
    );
    const el = screen.getByTestId("stack");
    expect(el.style.getPropertyValue("--stack-gap")).toBe("var(--space-6)");
    expect(el.style.color).toBe("red");
  });

  // --- Error path: Radix Slot's single-child contract (asChild) ---

  it("forwards data-* onto the slotted child element under asChild", () => {
    render(
      <Stack asChild data-foo="bar" data-testid="stack">
        <section>content</section>
      </Stack>,
    );
    const el = screen.getByTestId("stack");
    expect(el.tagName).toBe("SECTION");
    expect(el).toHaveAttribute("data-foo", "bar");
  });

  it("fails LOUDLY when asChild receives multiple children (no silent swallow)", () => {
    // Radix Slot requires exactly one element child; more than one throws rather than dropping
    // the extras silently. Pin that the failure is loud so a misuse can't ship a broken layout.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Stack asChild>
          <span>a</span>
          <span>b</span>
        </Stack>,
      ),
    ).toThrow(/single React element child/i);
    spy.mockRestore();
  });
});
