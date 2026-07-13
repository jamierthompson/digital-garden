// MissingSlot's contract: the notice stays a non-fatal `role="note"`, its two lines are
// paragraphs (never headings that would pollute the entry outline), and the unresolved
// `slotKey` is echoed inside a <code> so the editor can spot the drift.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MissingSlot from "./MissingSlot";

describe("MissingSlot", () => {
  it("renders a non-urgent note landmark, not an alert", () => {
    render(<MissingSlot slotKey="retired-widget" />);
    const note = screen.getByRole("note");
    expect(note).toBeInTheDocument();
    // `role="note"` keeps it informative; it must NOT escalate to an alert.
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
    // The <code> sits inside the note so the editor sees exactly which key drifted.
    expect(code.closest('[role="note"]')).not.toBeNull();
  });

  it("keeps both lines out of the heading outline (label is a paragraph, not an hN)", () => {
    // The `label` type role is a KICKER register, not a document heading: rendering it through
    // `Text` (a <p>) keeps it out of the outline, so it can't collide with the entry's h1.
    render(<MissingSlot slotKey="retired-widget" />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Slot unavailable").tagName).toBe("P");
  });

  it("renders an unusual slotKey verbatim (no swallowing of special characters)", () => {
    render(<MissingSlot slotKey="__proto__" />);
    expect(screen.getByText("__proto__").tagName).toBe("CODE");
  });
});
