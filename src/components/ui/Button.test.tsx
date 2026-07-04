// QA #131 — Button contract: always type="button" (never an implicit submit inside a
// future form) and it fires its handler.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Button from "./Button";

describe("Button", () => {
  it("is always type=button", () => {
    render(<Button onClick={() => {}}>Copy</Button>);
    expect(screen.getByRole("button", { name: "Copy" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Copy</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
