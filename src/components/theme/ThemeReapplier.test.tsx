import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ThemeReapplier from "./ThemeReapplier";

afterEach(() => document.documentElement.removeAttribute("style"));

describe("ThemeReapplier", () => {
  it("stamps the declarations onto <html> on mount (soft-nav application)", () => {
    render(<ThemeReapplier declarations={[["--accent", "red"]]} />);
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      "red",
    );
  });

  it("re-applies when the declarations prop changes (seed change / ephemeral play)", () => {
    const { rerender } = render(
      <ThemeReapplier declarations={[["--accent", "red"]]} />,
    );
    rerender(<ThemeReapplier declarations={[["--accent", "blue"]]} />);
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      "blue",
    );
  });

  it("re-applies on remount — the layout-effect behavior <Activity> relies on for reveal", () => {
    // The slice-1 spike proved a LAYOUT effect (not an insertion effect) re-runs when React
    // reveals a hidden <Activity>. jsdom has no Activity, so mount/remount is the faithful
    // unit proxy: React re-runs the layout effect on mount, re-asserting this route's theme
    // over whatever the previously-visible route left on the shared <html>.
    const { unmount } = render(
      <ThemeReapplier declarations={[["--accent", "orange"]]} />,
    );
    unmount();
    document.documentElement.style.setProperty("--accent", "blue"); // another route themed <html>
    render(<ThemeReapplier declarations={[["--accent", "orange"]]} />);
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      "orange",
    );
  });

  it("does not clobber the inline color-scheme (scheme-toggle coexistence)", () => {
    document.documentElement.style.colorScheme = "dark";
    render(<ThemeReapplier declarations={[["--accent", "red"]]} />);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("renders no DOM", () => {
    const { container } = render(<ThemeReapplier declarations={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
