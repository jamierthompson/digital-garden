import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { space } from "@/lib/tokens";

import Cluster from "./Cluster";

describe("Cluster", () => {
  it("renders a <div> wrapping its children by default", () => {
    render(
      <Cluster data-testid="cluster">
        <span>a</span>
        <span>b</span>
      </Cluster>,
    );
    const el = screen.getByTestId("cluster");
    expect(el.tagName).toBe("DIV");
    expect(el).toContainElement(screen.getByText("a"));
    expect(el).toContainElement(screen.getByText("b"));
  });

  it("passes the gap token through the --cluster-gap custom property (the conduit)", () => {
    render(<Cluster gap={space(6)} data-testid="cluster" />);
    expect(
      screen.getByTestId("cluster").style.getPropertyValue("--cluster-gap"),
    ).toBe("var(--space-6)");
  });

  it("sets no --cluster-gap when gap is omitted (CSS default applies)", () => {
    render(<Cluster data-testid="cluster" />);
    expect(
      screen.getByTestId("cluster").style.getPropertyValue("--cluster-gap"),
    ).toBe("");
  });

  it("merges a caller className alongside its own", () => {
    render(<Cluster className="caller" data-testid="cluster" />);
    // Own (hashed) class is present too; toHaveClass matches within the merged list.
    expect(screen.getByTestId("cluster")).toHaveClass("caller");
  });

  it("lets a caller style override the token (escape hatch: caller wins)", () => {
    render(
      <Cluster
        gap={space(6)}
        style={{ "--cluster-gap": space(2) } as React.CSSProperties}
        data-testid="cluster"
      />,
    );
    expect(
      screen.getByTestId("cluster").style.getPropertyValue("--cluster-gap"),
    ).toBe("var(--space-2)");
  });

  it("renders the child element instead of a <div> when asChild, merging the gap onto it", () => {
    render(
      <Cluster asChild gap={space(5)} data-testid="cluster">
        <div>
          <span>only child</span>
        </div>
      </Cluster>,
    );
    const el = screen.getByTestId("cluster");
    expect(el.tagName).toBe("DIV");
    expect(el.style.getPropertyValue("--cluster-gap")).toBe("var(--space-5)");
  });

  // --- Boundary: the gap conduit's truthiness gate ---

  it("falls back to the CSS default when gap is an empty string (writes no --cluster-gap)", () => {
    // `gap ? … : null` treats "" as falsy, so the conduit writes nothing and the CSS default
    // (var(--cluster-gap, var(--space-cluster))) applies — a broken `--cluster-gap:` is never emitted.
    render(<Cluster gap="" data-testid="cluster" />);
    expect(
      screen.getByTestId("cluster").style.getPropertyValue("--cluster-gap"),
    ).toBe("");
  });

  it("writes a literal zero gap through the conduit (gap='0' is a real length, not a fallback)", () => {
    render(<Cluster gap="0" data-testid="cluster" />);
    expect(
      screen.getByTestId("cluster").style.getPropertyValue("--cluster-gap"),
    ).toBe("0");
  });

  it("passes an engine-style clamp() value straight through the conduit unchanged", () => {
    render(<Cluster gap="clamp(1rem, 2vw, 2rem)" data-testid="cluster" />);
    expect(
      screen.getByTestId("cluster").style.getPropertyValue("--cluster-gap"),
    ).toBe("clamp(1rem, 2vw, 2rem)");
  });

  // --- Contract: native attribute + ref forwarding ---

  it("forwards native, aria, role and data-* attributes onto the element", () => {
    render(
      <Cluster
        data-testid="cluster"
        role="list"
        aria-label="tags"
        data-foo="bar"
      />,
    );
    const el = screen.getByTestId("cluster");
    expect(el).toHaveAttribute("role", "list");
    expect(el).toHaveAttribute("aria-label", "tags");
    expect(el).toHaveAttribute("data-foo", "bar");
  });

  // A layout primitive must be reachable by ref so it can be measured / scrolled-to / observed
  // (e.g. for View-Transition work). The prop type extends `ComponentPropsWithRef<"div">`, so
  // `<Cluster ref>` type-checks, and the `...rest` spread forwards the ref onto the real element.
  it("forwards a ref to the underlying div", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Cluster ref={ref} data-testid="cluster" />);
    expect(ref.current).toBe(screen.getByTestId("cluster"));
    expect(ref.current?.tagName).toBe("DIV");
  });

  // Under `asChild`, Radix `Slot` routes a ref put on `<Cluster>` to the rendered child (the direct
  // analog of the widened type), AND preserves the child's own ref instead of clobbering it — both
  // resolve to the same child element. Note the Cluster ref stays typed `HTMLDivElement` (Cluster's
  // declared element) even though it lands on the `<ul>` at runtime; `asChild` can't narrow the
  // ref's element type, matching how Radix's own primitives type `asChild`.
  it("routes a Cluster ref to the child under asChild without clobbering the child's own ref", () => {
    const clusterRef = createRef<HTMLDivElement>();
    const childRef = createRef<HTMLUListElement>();
    render(
      <Cluster asChild ref={clusterRef}>
        <ul ref={childRef} data-testid="cluster">
          <li>only child</li>
        </ul>
      </Cluster>,
    );
    const child = screen.getByTestId("cluster");
    expect(clusterRef.current).toBe(child);
    expect(childRef.current).toBe(child);
    expect(child.tagName).toBe("UL");
  });

  it("merges a caller className with no stray 'undefined' when className is omitted", () => {
    const { container } = render(<Cluster data-testid="cluster" />);
    // Only the hashed own-class should be present — the filter(Boolean) must drop the undefined
    // className so the class list never contains the string "undefined".
    expect(container.firstElementChild?.className).not.toContain("undefined");
    expect(
      container.firstElementChild?.className.trim().length,
    ).toBeGreaterThan(0);
  });

  it("merges non-gap caller style props alongside the token (both survive)", () => {
    render(
      <Cluster gap={space(6)} style={{ color: "red" }} data-testid="cluster" />,
    );
    const el = screen.getByTestId("cluster");
    expect(el.style.getPropertyValue("--cluster-gap")).toBe("var(--space-6)");
    expect(el.style.color).toBe("red");
  });

  // --- Error path: Radix Slot's single-child contract (asChild) ---

  it("forwards data-* onto the slotted child element under asChild", () => {
    render(
      <Cluster asChild data-foo="bar" data-testid="cluster">
        <section>content</section>
      </Cluster>,
    );
    const el = screen.getByTestId("cluster");
    expect(el.tagName).toBe("SECTION");
    expect(el).toHaveAttribute("data-foo", "bar");
  });

  it("fails LOUDLY when asChild receives multiple children (no silent swallow)", () => {
    // Radix Slot requires exactly one element child; more than one throws rather than dropping
    // the extras silently. Pin that the failure is loud so a misuse can't ship a broken layout.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Cluster asChild>
          <span>a</span>
          <span>b</span>
        </Cluster>,
      ),
    ).toThrow(/single React element child/i);
    spy.mockRestore();
  });

  it("writes a units-bearing zero gap through the conduit (gap='0px' is a real length)", () => {
    // The truthiness gate only drops "" — every other non-empty string, including a units-bearing
    // zero, is a valid length and passes straight through (companion to the bare `gap="0"` case).
    render(<Cluster gap="0px" data-testid="cluster" />);
    expect(
      screen.getByTestId("cluster").style.getPropertyValue("--cluster-gap"),
    ).toBe("0px");
  });

  // --- asChild: the real adoption shape (a slotted child that already carries class + style) ---

  it("merges its class onto a slotted child that already has its own className (both survive)", () => {
    // Radix Slot must keep the child's own class AND add the cluster's — neither clobbers the other.
    render(
      <Cluster asChild>
        <div className="caller" data-testid="cluster" />
      </Cluster>,
    );
    const el = screen.getByTestId("cluster");
    expect(el).toHaveClass("caller"); // child's own class kept
    // The cluster's hashed class is present too (2+ classes in the merged list).
    expect(el.className.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
  });

  it("lets the cluster's gap conduit and the child's own non-gap style coexist under asChild", () => {
    render(
      <Cluster asChild gap={space(6)}>
        <div data-testid="cluster" style={{ color: "blue" }} />
      </Cluster>,
    );
    const el = screen.getByTestId("cluster");
    expect(el.style.getPropertyValue("--cluster-gap")).toBe("var(--space-6)");
    expect(el.style.color).toBe("blue"); // child's own style is not dropped
  });

  it("lets a slotted child's own --cluster-gap win over the cluster's gap prop (escape hatch under asChild)", () => {
    // Under asChild the child IS the caller, so the "caller wins" merge means a child that sets
    // its own --cluster-gap overrides the primitive's gap prop — the escape hatch still holds.
    render(
      <Cluster asChild gap={space(6)}>
        <div
          data-testid="cluster"
          style={{ "--cluster-gap": space(1) } as React.CSSProperties}
        />
      </Cluster>,
    );
    expect(
      screen.getByTestId("cluster").style.getPropertyValue("--cluster-gap"),
    ).toBe("var(--space-1)");
  });

  it("renders nothing (no throw) when asChild has zero element children", () => {
    // Radix Slot with no child renders null rather than crashing — pin the graceful degradation
    // so an empty conditional child can't take the layout down.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<Cluster asChild />);
    expect(container.innerHTML).toBe("");
    spy.mockRestore();
  });
});

/**
 * The primitive's whole reason to exist is a row that WRAPS — every consumer's intrinsic
 * (no-`@media`) reflow rides these two declarations. jsdom performs no layout, so pin them
 * at the source: deleting `flex-wrap: wrap` would break every wrapping row with all
 * component tests still green.
 */
describe("Cluster.module.css — the wrapping row it promises", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/layout/Cluster.module.css"),
    "utf8",
  );
  const rule = css.match(/\.cluster\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  it("finds the .cluster rule", () => {
    expect(rule, "expected a .cluster {…} rule in the module").not.toBe("");
  });

  it("lays out with flex and wraps", () => {
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/flex-wrap:\s*wrap/);
  });
});
