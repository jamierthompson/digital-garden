import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Ink from "./Ink";

describe("Ink", () => {
  it("renders a span wearing the shared ink contract (data-color + the .ink rules)", () => {
    render(<Ink color="harmony-complementary-text">a colored run</Ink>);
    const run = screen.getByText("a colored run");
    expect(run.tagName).toBe("SPAN");
    expect(run).toHaveAttribute("data-color", "harmony-complementary-text");
    expect(run.className).not.toBe("");
  });

  it("owns no type role — no data-variant, so the surrounding role's type inherits", () => {
    render(
      <h1>
        before <Ink color="accent-text">emphasized</Ink> after
      </h1>,
    );
    const run = screen.getByText("emphasized");
    expect(run).not.toHaveAttribute("data-variant");
  });

  it("merges a passthrough className and keeps the typed color prop over a stray data-color", () => {
    render(
      <Ink
        color="foreground"
        className="extra"
        {...{ "data-color": "smuggled" }}
      >
        run
      </Ink>,
    );
    const run = screen.getByText("run");
    expect(run.className).toContain("extra");
    expect(run).toHaveAttribute("data-color", "foreground");
  });
});
