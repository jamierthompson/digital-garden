import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { SCHEME_STORAGE_KEY } from "@/lib/scheme";

import { readModuleCss, ruleDeclarations } from "../../../tests/cssModule";

import styles from "./SchemeToggle.module.css";
import SchemeToggle from "./SchemeToggle";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("style");
});

describe("SchemeToggle", () => {
  it("renders a labelled dark-mode switch", () => {
    render(<SchemeToggle />);
    expect(
      screen.getByRole("switch", { name: "Dark mode" }),
    ).toBeInTheDocument();
  });

  it("is off by default when the OS prefers light (setup stub never matches)", async () => {
    render(<SchemeToggle />);
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Dark mode" }),
      ).not.toBeChecked(),
    );
  });

  it("reflects a persisted dark override (switch on)", async () => {
    localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
    render(<SchemeToggle />);
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Dark mode" })).toBeChecked(),
    );
  });

  it("turning it on persists and applies dark", () => {
    render(<SchemeToggle />);
    fireEvent.click(screen.getByRole("switch", { name: "Dark mode" }));
    expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(screen.getByRole("switch", { name: "Dark mode" })).toBeChecked();
  });

  it("turning it off persists and applies light", () => {
    localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
    render(<SchemeToggle />);
    fireEvent.click(screen.getByRole("switch", { name: "Dark mode" }));
    expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(screen.getByRole("switch", { name: "Dark mode" })).not.toBeChecked();
  });

  it("flanking sun/moon icons are decorative (hidden from assistive tech)", () => {
    const { container } = render(<SchemeToggle />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    svgs.forEach((svg) => expect(svg).toHaveAttribute("aria-hidden", "true"));
  });

  describe("QA — adversarial", () => {
    it("SSR markup is scheme-agnostic — never claims a state it cannot know", () => {
      // The server can't read the OS preference or localStorage, so the SSR snapshot must be
      // the neutral off/light state even when a dark override is persisted — otherwise the
      // markup would assert a scheme it might have wrong, risking a hydration mismatch. The
      // colors are corrected pre-paint by the inline init script; only the thumb settles.
      localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
      const html = renderToStaticMarkup(<SchemeToggle />);
      expect(html).toContain('data-state="unchecked"');
      expect(html).not.toContain('data-state="checked"');
    });

    it("exposes a native, focusable switch (keyboard-operable) with an accessible name", () => {
      render(<SchemeToggle />);
      const toggle = screen.getByRole("switch", { name: "Dark mode" });
      // Radix Switch renders a native <button> — natively operable via Space/Enter, no custom
      // key handling needed. Assert the underlying element + that it can hold focus.
      expect(toggle.tagName).toBe("BUTTON");
      toggle.focus();
      expect(toggle).toHaveFocus();
    });

    it("rapid clicks settle on a consistent final state", () => {
      render(<SchemeToggle />);
      const toggle = screen.getByRole("switch", { name: "Dark mode" });
      fireEvent.click(toggle); // → dark
      fireEvent.click(toggle); // → light
      fireEvent.click(toggle); // → dark
      expect(toggle).toBeChecked();
      expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });

    it("sizes both icons from --size-icon — the ONLY thing standing between the nav and a 740px SVG", () => {
      // The icons carry no `width`/`height` attributes: geometry moved entirely to the
      // module's `.icon` rule. That makes the CSS load-bearing in a way the attributes never
      // were — an `<svg>` with a viewBox but no attribute size and no CSS size falls to the
      // replaced-element default sizing rules, which in a real browser resolve
      // to the full available inline size. Measured headless Chrome 1:1 viewBox, unstyled:
      // 740×740 CSS px against the shipped 16×16. jsdom lays nothing out, so pin the source.
      const css = readModuleCss(
        "src/components/site-chrome/SchemeToggle.module.css",
      );
      const icon = ruleDeclarations(css, ".icon");
      expect(icon.get("inline-size")).toBe("var(--size-icon)");
      expect(icon.get("block-size")).toBe("var(--size-icon)");
    });

    it("--size-icon actually exists, so the icon rule can't resolve to auto", () => {
      // `inline-size: var(--size-icon)` with the token undefined is invalid at
      // computed-value time → the property falls back to `auto` → the same blowup as having
      // no rule at all. Renaming the foundation token would leave every assertion above
      // green, so pin the token's existence at its declaring sheet.
      const dimension = readModuleCss("src/styles/foundation/dimension.css");
      expect(ruleDeclarations(dimension, ":root").get("--size-icon")).toBe(
        "1rem",
      );
    });

    it("keeps a viewBox on both icons — the intrinsic ratio the CSS sizing depends on", () => {
      // Without a viewBox the SVG has no intrinsic ratio and the artwork stops scaling with
      // the box, so the glyph would clip rather than resize.
      const { container } = render(<SchemeToggle />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs).toHaveLength(2);
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
        // The attributes were deliberately removed; if they come back they'd silently
        // outrank nothing but would re-split the geometry across two sources of truth.
        expect(svg).not.toHaveAttribute("width");
        expect(svg).not.toHaveAttribute("height");
      });
    });

    it("both icons carry the sizing class, not just the active one", () => {
      // `.icon` is what applies the geometry. The className is built by string concatenation
      // with the active modifier, so a refactor that drops the base class from one branch
      // would blow up exactly one icon — and only in the scheme that isn't currently active.
      const { container } = render(<SchemeToggle />);
      const svgs = container.querySelectorAll("svg");
      svgs.forEach((svg) => expect(svg).toHaveClass(styles.icon));
    });

    it("reflects a cross-tab change live (subscription is wired)", async () => {
      render(<SchemeToggle />);
      const toggle = screen.getByRole("switch", { name: "Dark mode" });
      expect(toggle).not.toBeChecked();
      act(() => {
        localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
        window.dispatchEvent(
          new StorageEvent("storage", { key: SCHEME_STORAGE_KEY }),
        );
      });
      await waitFor(() => expect(toggle).toBeChecked());
    });
  });
});
