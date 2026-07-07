import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
