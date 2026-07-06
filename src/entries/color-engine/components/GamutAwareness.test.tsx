import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ColorEngineProvider from "../ColorEngineProvider";
import GamutAwareness from "./GamutAwareness";

function renderAwareness() {
  return render(
    <ColorEngineProvider slug="demo">
      <GamutAwareness />
    </ColorEngineProvider>,
  );
}

describe("GamutAwareness", () => {
  it("renders BOTH screen states in the HTML — CSS toggles which shows, so no hydration mismatch", () => {
    renderAwareness();
    const note = screen.getByRole("note", { name: /your screen/i });
    // Both the sRGB and the Display-P3 labels are present; the `color-gamut` media query (not
    // JS) decides which one is visible, so the markup is identical server- and client-side.
    expect(within(note).getByText("sRGB")).toBeInTheDocument();
    expect(within(note).getByText(/display-p3 capable/i)).toBeInTheDocument();
  });

  it("reassures on the default sRGB target — the colors paint identically everywhere", () => {
    renderAwareness();
    expect(
      screen.getByText(/paint identically on every screen/i),
    ).toBeInTheDocument();
    // The default target is sRGB, so there is no P3-clamp warning.
    expect(screen.queryByText(/trimmed to fit/i)).not.toBeInTheDocument();
  });
});
