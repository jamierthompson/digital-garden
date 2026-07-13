import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MissingSlot from "./MissingSlot";

describe("MissingSlot", () => {
  it("renders a non-urgent note landmark, not an alert", () => {
    render(<MissingSlot slotKey="retired-widget" />);
    const note = screen.getByRole("note");
    expect(note).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the 'Slot unavailable' label and the drift detail", () => {
    render(<MissingSlot slotKey="retired-widget" />);
    expect(screen.getByText("Slot unavailable")).toBeInTheDocument();
    expect(screen.getByText(/slot could not be resolved/i)).toBeInTheDocument();
  });

  it("echoes the unresolved slotKey inside a <code>", () => {
    render(<MissingSlot slotKey="retired-widget" />);
    const code = screen.getByText("retired-widget");
    expect(code.tagName).toBe("CODE");
    expect(code.closest('[role="note"]')).not.toBeNull();
  });

  it("keeps both lines out of the heading outline (label is a paragraph, not an hN)", () => {
    render(<MissingSlot slotKey="retired-widget" />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Slot unavailable").tagName).toBe("P");
  });

  it("renders an unusual slotKey verbatim (no swallowing of special characters)", () => {
    render(<MissingSlot slotKey="__proto__" />);
    expect(screen.getByText("__proto__").tagName).toBe("CODE");
  });
});
