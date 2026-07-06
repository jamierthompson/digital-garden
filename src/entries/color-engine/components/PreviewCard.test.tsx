import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PreviewCard from "./PreviewCard";

describe("PreviewCard", () => {
  it("renders the specimens as a scheme-neutral 'palette preview' group", () => {
    render(<PreviewCard />);
    const panel = screen.getByRole("group", { name: "palette preview" });
    // Real component shapes reading the semantic tokens (which the SLOT re-binds).
    expect(screen.getByText("A card on this palette")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    // No scheme in the accessible name (single-scheme Color Engine; the viewer's scheme is CSS-resolved).
    expect(
      screen.queryByRole("group", { name: /light preview|dark preview/ }),
    ).not.toBeInTheDocument();
    // Sets NO inline color-scheme — it inherits (the #159 contract), so the toggle isn't shadowed
    // and the specimens follow the browser's resolved scheme at first paint.
    expect(panel.style.colorScheme).toBe("");
  });

  it("does NOT re-bind tokens inline — it inherits the slot's light-dark() palette", () => {
    render(<PreviewCard />);
    const panel = screen.getByRole("group", { name: "palette preview" });
    // The old per-scheme inline re-bind is gone; the slot owns the palette binding now.
    expect(panel.style.getPropertyValue("--accent")).toBe("");
    expect(panel.style.getPropertyValue("--surface")).toBe("");
  });

  it("shows the 34-token specimens — status badges, a container alert, state rows, and the scrim dialog", () => {
    render(<PreviewCard />);
    // Status badge text is the text-legible `--<status>-text`, the outline the fill `--<status>`.
    const failed = screen.getByText("Failed");
    expect(failed.style.color).toBe("var(--error-text)");
    expect(failed.style.borderColor).toBe("var(--error)");
    // The new container / interaction-state / overlay specimens are present.
    expect(screen.getByText(/soft error container/i)).toBeInTheDocument();
    expect(screen.getByText("Hovered row")).toBeInTheDocument();
    expect(screen.getByText("Selected row")).toBeInTheDocument();
    expect(screen.getByText("Dialog")).toBeInTheDocument();
  });
});
