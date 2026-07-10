import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Page from "./Page";

describe("Page", () => {
  it("renders a <main> wrapping its children by default", () => {
    render(
      <Page data-testid="page">
        <span>a</span>
      </Page>,
    );
    const el = screen.getByTestId("page");
    expect(el.tagName).toBe("MAIN");
    expect(el).toContainElement(screen.getByText("a"));
  });

  it("is the skip-link target: renders id='main-content'", () => {
    render(<Page data-testid="page" />);
    expect(screen.getByTestId("page")).toHaveAttribute("id", "main-content");
  });

  it("passes the width role through the --page-width conduit", () => {
    render(<Page width="page" data-testid="page" />);
    expect(
      screen.getByTestId("page").style.getPropertyValue("--page-width"),
    ).toBe("var(--width-page)");
  });

  it("defaults to the content width role when width is omitted", () => {
    render(<Page data-testid="page" />);
    expect(
      screen.getByTestId("page").style.getPropertyValue("--page-width"),
    ).toBe("var(--width-content)");
  });

  it.each([
    ["measure", "var(--width-measure)"],
    ["content", "var(--width-content)"],
    ["page", "var(--width-page)"],
  ] as const)("maps width='%s' to %s", (width, expected) => {
    render(<Page width={width} data-testid="page" />);
    expect(
      screen.getByTestId("page").style.getPropertyValue("--page-width"),
    ).toBe(expected);
  });

  it("merges a caller className alongside its own", () => {
    render(<Page className="caller" data-testid="page" />);
    expect(screen.getByTestId("page")).toHaveClass("caller");
  });

  it("lets a caller style override the width token (escape hatch: caller wins)", () => {
    render(
      <Page
        width="page"
        style={
          { "--page-width": "var(--width-measure)" } as React.CSSProperties
        }
        data-testid="page"
      />,
    );
    expect(
      screen.getByTestId("page").style.getPropertyValue("--page-width"),
    ).toBe("var(--width-measure)");
  });

  it("merges non-width caller style props alongside the token (both survive)", () => {
    render(<Page width="page" style={{ color: "red" }} data-testid="page" />);
    const el = screen.getByTestId("page");
    expect(el.style.getPropertyValue("--page-width")).toBe("var(--width-page)");
    expect(el.style.color).toBe("red");
  });

  it("lets a caller override the id via passthrough (rest wins over the default)", () => {
    render(<Page id="custom" data-testid="page" />);
    expect(screen.getByTestId("page")).toHaveAttribute("id", "custom");
  });

  // --- asChild: render onto the provided element, still owning the landmark ---

  it("renders the child element instead of a <main> when asChild, merging id + width onto it", () => {
    render(
      <Page asChild width="page" data-testid="page">
        <article>content</article>
      </Page>,
    );
    const el = screen.getByTestId("page");
    expect(el.tagName).toBe("ARTICLE");
    expect(el).toHaveAttribute("id", "main-content");
    expect(el.style.getPropertyValue("--page-width")).toBe("var(--width-page)");
  });

  it("fails LOUDLY when asChild receives multiple children (no silent swallow)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Page asChild>
          <span>a</span>
          <span>b</span>
        </Page>,
      ),
    ).toThrow(/single React element child/i);
    spy.mockRestore();
  });

  // --- Contract: native attribute + ref forwarding ---

  it("forwards native, aria, role and data-* attributes onto the element", () => {
    render(<Page data-testid="page" aria-label="content" data-foo="bar" />);
    const el = screen.getByTestId("page");
    expect(el).toHaveAttribute("aria-label", "content");
    expect(el).toHaveAttribute("data-foo", "bar");
  });

  it("forwards a ref to the underlying <main>", () => {
    const ref = createRef<HTMLElement>();
    render(<Page ref={ref} data-testid="page" />);
    expect(ref.current).toBe(screen.getByTestId("page"));
    expect(ref.current?.tagName).toBe("MAIN");
  });

  it("routes a Page ref to the child under asChild without clobbering the child's own ref", () => {
    const pageRef = createRef<HTMLElement>();
    const childRef = createRef<HTMLElement>();
    render(
      <Page asChild ref={pageRef}>
        <article ref={childRef} data-testid="page">
          content
        </article>
      </Page>,
    );
    const child = screen.getByTestId("page");
    expect(pageRef.current).toBe(child);
    expect(childRef.current).toBe(child);
    expect(child.tagName).toBe("ARTICLE");
  });

  it("merges a caller className with no stray 'undefined' when className is omitted", () => {
    const { container } = render(<Page data-testid="page" />);
    expect(container.firstElementChild?.className).not.toContain("undefined");
    expect(
      container.firstElementChild?.className.trim().length,
    ).toBeGreaterThan(0);
  });
});
