import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Text, { type TextVariant } from "./Text";

describe("Text", () => {
  it("renders a <p> in the body role by default", () => {
    render(<Text data-testid="t">Copy</Text>);
    const el = screen.getByTestId("t");
    expect(el.tagName).toBe("P");
    expect(el).toHaveAttribute("data-variant", "body");
  });

  it("selects the role via data-variant", () => {
    for (const variant of [
      "body",
      "lead",
      "label",
      "meta",
      "caption",
      "quote",
    ] as const) {
      const { unmount } = render(
        <Text variant={variant} data-testid="t">
          x
        </Text>,
      );
      expect(screen.getByTestId("t")).toHaveAttribute("data-variant", variant);
      unmount();
    }
  });

  // The prop is named `variant`, NOT `role`, precisely so the ARIA `role` attribute stays a real
  // passthrough — a Text can wear a type role AND an ARIA role at once, without collision.
  it("passes the ARIA role attribute through independently of the type variant", () => {
    render(
      <Text variant="meta" role="status" data-testid="t">
        Saved
      </Text>,
    );
    const el = screen.getByTestId("t");
    expect(el).toHaveAttribute("data-variant", "meta");
    expect(el).toHaveAttribute("role", "status");
    // The status role is exposed to the a11y tree.
    expect(screen.getByRole("status")).toBe(el);
  });

  it("merges a caller className alongside its own", () => {
    render(
      <Text className="caller" data-testid="t">
        x
      </Text>,
    );
    expect(screen.getByTestId("t")).toHaveClass("caller");
  });

  it("merges a caller className with no stray 'undefined' when className is omitted", () => {
    const { container } = render(<Text>x</Text>);
    const className = container.firstElementChild?.className ?? "";
    expect(className).not.toContain("undefined");
    expect(className.trim().length).toBeGreaterThan(0);
  });

  it("forwards native, aria, and data-* attributes onto the element", () => {
    render(
      <Text data-testid="t" aria-label="updated" data-foo="bar" id="p1">
        x
      </Text>,
    );
    const el = screen.getByTestId("t");
    expect(el).toHaveAttribute("aria-label", "updated");
    expect(el).toHaveAttribute("data-foo", "bar");
    expect(el).toHaveAttribute("id", "p1");
  });

  it("passes a caller style through unchanged", () => {
    render(
      <Text style={{ color: "red" }} data-testid="t">
        x
      </Text>,
    );
    expect(screen.getByTestId("t").style.color).toBe("red");
  });

  it("forwards a ref to the underlying paragraph element", () => {
    const ref = createRef<HTMLParagraphElement>();
    render(
      <Text ref={ref} data-testid="t">
        x
      </Text>,
    );
    expect(ref.current).toBe(screen.getByTestId("t"));
    expect(ref.current?.tagName).toBe("P");
  });

  it("renders the child element instead of a <p> under asChild, merging class + data-variant", () => {
    render(
      <Text variant="meta" asChild className="caller">
        <time dateTime="2026-07-08" data-testid="t">
          Jul 8
        </time>
      </Text>,
    );
    const el = screen.getByTestId("t");
    expect(el.tagName).toBe("TIME");
    expect(el).toHaveAttribute("data-variant", "meta");
    expect(el).toHaveClass("caller");
    expect(el).toHaveAttribute("datetime", "2026-07-08");
  });

  it("fails LOUDLY when asChild receives multiple children (no silent swallow)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Text asChild>
          <span>a</span>
          <span>b</span>
        </Text>,
      ),
    ).toThrow(/single React element child/i);
    spy.mockRestore();
  });

  it("fails LOUDLY when asChild receives a lone non-element child (plain text)", () => {
    // A string is a single child but not a single React ELEMENT — Slot must throw, not
    // silently drop the role/class on the floor.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Text asChild>just text</Text>)).toThrow(
      /single React element child/i,
    );
    spy.mockRestore();
  });

  it("forwards a ref to the slotted child under asChild", () => {
    // NOTE the type wrinkle: TextProps types the ref as Ref<HTMLParagraphElement> even under
    // asChild, where it actually lands on the slotted child (here a <time>). Runtime is correct;
    // the static type over-promises — same shape as Heading's asChild ref test.
    const ref = createRef<HTMLParagraphElement>();
    render(
      <Text variant="meta" asChild ref={ref}>
        <time dateTime="2026-07-08" data-testid="t">
          Jul 8
        </time>
      </Text>,
    );
    expect(ref.current).toBe(screen.getByTestId("t"));
    expect(ref.current?.tagName).toBe("TIME");
  });

  it("stamps the DEFAULT body variant under asChild too", () => {
    render(
      <Text asChild>
        <span data-testid="t">x</span>
      </Text>,
    );
    expect(screen.getByTestId("t")).toHaveAttribute("data-variant", "body");
  });

  it("passes the ARIA role through under asChild — variant and role stay independent on the child", () => {
    render(
      <Text variant="meta" role="status" asChild>
        <span data-testid="t">Saved</span>
      </Text>,
    );
    const el = screen.getByTestId("t");
    expect(el).toHaveAttribute("data-variant", "meta");
    expect(screen.getByRole("status")).toBe(el);
  });

  it("preserves the slotted child's OWN className alongside the primitive's + the caller's", () => {
    render(
      <Text asChild className="caller">
        <span className="childs-own" data-testid="t">
          x
        </span>
      </Text>,
    );
    const el = screen.getByTestId("t");
    // Slot JOINS classNames — the child's class must survive the merge, not be clobbered.
    expect(el).toHaveClass("childs-own");
    expect(el).toHaveClass("caller");
    expect(el.className).not.toContain("undefined");
  });

  it("merges the caller style with the slotted child's own style under asChild", () => {
    render(
      <Text asChild style={{ color: "red" }}>
        <span style={{ marginTop: "1px" }} data-testid="t">
          x
        </span>
      </Text>,
    );
    const el = screen.getByTestId("t");
    expect(el.style.color).toBe("red");
    expect(el.style.marginTop).toBe("1px");
  });
});

// Holds `TextVariant` to `Text.module.css`'s `[data-variant]` bundles. Without it, adding a
// variant to the type but forgetting its module rule renders the text in the `body` bundle (the
// base class) with the whole gate green — a silent fail. Parse the sheet and pin the set both ways.
describe("TextVariant ↔ Text.module.css bundle bijection", () => {
  // Compile-time exhaustiveness: listing a variant the type lacks, or missing one it has, fails
  // typecheck here — the runtime half below then holds the CSS to the same list.
  const VARIANTS = [
    "body",
    "lead",
    "label",
    "meta",
    "caption",
    "quote",
  ] as const satisfies readonly TextVariant[];
  type Uncovered = Exclude<TextVariant, (typeof VARIANTS)[number]>;
  const noUncoveredVariant: Uncovered extends never ? true : never = true;

  const sheet = readFileSync(
    resolve(process.cwd(), "src/components/typography/Text.module.css"),
    "utf8",
  );
  const sheetVariants = [
    ...sheet.matchAll(/\.text\[data-variant="([a-z0-9]+)"\]/g),
  ].map(([, variant]) => variant);

  it("declares exactly one bundle per non-base variant, and none the type lacks", () => {
    expect(noUncoveredVariant).toBe(true);
    // `body` is the base `.text` rule, not a data-variant bundle.
    const expected = VARIANTS.filter((variant) => variant !== "body");
    expect([...sheetVariants].sort()).toEqual([...expected].sort());
  });

  it("binds every bundle (and the base rule) to its OWN role's family token", () => {
    for (const variant of VARIANTS) {
      expect(sheet, `--type-${variant}-family`).toContain(
        `var(--type-${variant}-family)`,
      );
    }
  });
});
