import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  // --- Adversarial QA (#172): lifecycle edges around the shared-<html> handoff. ---

  describe("QA — lifecycle edges", () => {
    it("leaves the theme stamped after unmount — NO cleanup wipes the shared <html> (confirmed-safe, pinned)", () => {
      // Load-bearing for <Activity>: React destroys a hidden route's effects. If this
      // effect had a cleanup that removed properties, hiding route A could wipe the theme
      // route B just stamped (destroy/create ordering is not ours to rely on). The design
      // is overwrite-only; pin the absence of cleanup as behavior.
      const { unmount } = render(
        <ThemeReapplier declarations={[["--accent", "red"]]} />,
      );
      unmount();
      expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
        "red",
      );
    });

    it("an empty declarations set stamps nothing and disturbs nothing", () => {
      document.documentElement.style.colorScheme = "dark";
      render(<ThemeReapplier declarations={[]} />);
      expect(document.documentElement.style.length).toBe(1);
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });

    it("a fresh-identity, equal-content prop re-fires the effect harmlessly (idempotent re-stamp)", () => {
      // Every server render hands the client a NEW array identity for the same seed — the
      // effect re-runs by design. Pin that the re-stamp is invisible, not cumulative.
      const { rerender } = render(
        <ThemeReapplier declarations={[["--accent", "red"]]} />,
      );
      rerender(<ThemeReapplier declarations={[["--accent", "red"]]} />);
      const { style } = document.documentElement;
      expect(style.getPropertyValue("--accent")).toBe("red");
      expect(style.length).toBe(1);
    });

    it("server-renders as a silent no-op — the isomorphic hook takes the useEffect branch (no SSR warning)", async () => {
      // The hook is chosen at MODULE scope, so the server branch only exists on a fresh
      // import with no `window`. Re-import the module in that state and server-render it:
      // no "useLayoutEffect does nothing on the server" warning, no output, no DOM write.
      vi.resetModules();
      vi.stubGlobal("window", undefined);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      try {
        const { default: ServerThemeReapplier } =
          await import("./ThemeReapplier");
        const { renderToStaticMarkup } = await import("react-dom/server");
        const markup = renderToStaticMarkup(
          <ServerThemeReapplier declarations={[["--accent", "red"]]} />,
        );
        expect(markup).toBe("");
        expect(
          document.documentElement.style.getPropertyValue("--accent"),
        ).toBe("");
        const warnings = consoleError.mock.calls.flat().join(" ");
        expect(warnings).not.toContain("useLayoutEffect");
      } finally {
        consoleError.mockRestore();
        vi.unstubAllGlobals();
        vi.resetModules();
      }
    });
  });
});
