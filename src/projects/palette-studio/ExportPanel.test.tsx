import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildTokenSet } from "@garden/oklch";

import ExportPanel from "./ExportPanel";

const set = buildTokenSet("#7c3aed");

describe("ExportPanel", () => {
  it("defaults to the CSS tab and shows engine-serialized output", () => {
    render(<ExportPanel tokenSet={set} />);
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText(/:root/)).toBeInTheDocument();
    expect(
      within(panel).getByText(/--accent: light-dark\(oklch\(/),
    ).toBeInTheDocument();
  });

  it("switches export target when another tab is selected", () => {
    render(<ExportPanel tokenSet={set} />);
    // Radix Tabs default to automatic activation (on focus), so focus the trigger.
    fireEvent.focus(screen.getByRole("tab", { name: "Tailwind theme" }));
    expect(
      within(screen.getByRole("tabpanel")).getByText(/@theme/),
    ).toBeInTheDocument();
    fireEvent.focus(screen.getByRole("tab", { name: "JSON tokens" }));
    expect(
      within(screen.getByRole("tabpanel")).getByText(/"\$type": "color"/),
    ).toBeInTheDocument();
  });

  it("reserializes in the chosen color format", () => {
    render(<ExportPanel tokenSet={set} />);
    fireEvent.click(screen.getByRole("radio", { name: "Hex" }));
    expect(
      within(screen.getByRole("tabpanel")).getByText(/--accent: light-dark\(#/),
    ).toBeInTheDocument();
  });

  it("copies the active output to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ExportPanel tokenSet={set} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledOnce();
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain("--accent: light-dark(oklch(");
    expect(copied).toContain(":root");
  });
});
