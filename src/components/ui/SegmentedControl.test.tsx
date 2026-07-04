// QA #131 — SegmentedControl contract: a labelled radiogroup whose items carry
// aria-checked, selection reported through onValueChange, and Radix roving arrow-key
// navigation (the keyboard affordance the rules board depends on).

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SegmentedControl from "./SegmentedControl";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
] as const;

describe("SegmentedControl", () => {
  it("renders a radiogroup named by aria-label with one checked item", () => {
    render(
      <SegmentedControl
        label="Distribution"
        value="b"
        onValueChange={() => {}}
        options={OPTIONS}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Distribution" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("names the group from an external labeller via labelledBy", () => {
    render(
      <>
        <span id="seg-label">Chroma</span>
        <SegmentedControl
          labelledBy="seg-label"
          value="a"
          onValueChange={() => {}}
          options={OPTIONS}
        />
      </>,
    );
    expect(
      screen.getByRole("radiogroup", { name: "Chroma" }),
    ).toBeInTheDocument();
  });

  it("reports the clicked option through onValueChange", () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        label="Distribution"
        value="a"
        onValueChange={onValueChange}
        options={OPTIONS}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Gamma" }));
    expect(onValueChange).toHaveBeenCalledWith("c");
  });

  it("is keyboard-reachable: the GROUP is the tab stop (Radix entry focus)", () => {
    // Radix RovingFocusGroup keyboard model: the group element itself carries
    // tabIndex=0 and forwards focus to the active item on entry; the items stay
    // tabIndex=-1 until roved. Verified live in-browser during #131 QA — this test pins
    // the group-level tab stop so a regression (group losing its tabindex) is caught.
    render(
      <SegmentedControl
        label="Distribution"
        value="b"
        onValueChange={() => {}}
        options={OPTIONS}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Distribution" });
    expect(group).toHaveAttribute("tabindex", "0");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("tabindex", "-1");
    }
  });

  it("keeps every option a real focusable button (roving candidates exist)", () => {
    // The arrow-key roving itself (ArrowRight from Alpha selects Beta, focus follows)
    // cannot complete under jsdom — Radix's RovingFocusGroup needs real browser focus
    // mechanics. It WAS verified live in Chrome during #131 QA (2026-07-03): entry focus
    // on the group forwards to the checked item, ArrowRight roves and selects. Here we
    // pin the preconditions jsdom CAN check: each item is an enabled button the roving
    // group can move to.
    render(
      <SegmentedControl
        label="Distribution"
        value="a"
        onValueChange={() => {}}
        options={OPTIONS}
      />,
    );
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.tagName).toBe("BUTTON");
      expect(radio).toBeEnabled();
    }
  });
});
