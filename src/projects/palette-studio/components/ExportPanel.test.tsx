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

  // QA-S4-2: hex/rgb are the sRGB rendering; the UI must disclose it (and the P3 clamp is
  // lossy). OKLCH is lossless, so no note there.
  it("discloses hex/rgb as the sRGB rendering, and never for OKLCH", () => {
    render(<ExportPanel tokenSet={set} />);
    // Default OKLCH — no note.
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    // Hex — the note appears.
    fireEvent.click(screen.getByRole("radio", { name: "Hex" }));
    expect(screen.getByRole("note")).toHaveTextContent(/sRGB rendering/i);
    // Back to OKLCH — the note is gone.
    fireEvent.click(screen.getByRole("radio", { name: "OKLCH" }));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("warns that hex/rgb clamp a P3 palette (lossy)", () => {
    render(
      <ExportPanel tokenSet={buildTokenSet("#7c3aed", { gamut: "p3" })} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "RGB" }));
    expect(screen.getByRole("note")).toHaveTextContent(/P3.*sRGB|lossy/i);
  });
});
