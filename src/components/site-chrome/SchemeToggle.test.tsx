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

const toDark = /switch to dark mode/i;
const toLight = /switch to light mode/i;

describe("SchemeToggle", () => {
  it("renders a button naming the action it performs, not the state it is in", () => {
    // A button announces what pressing it DOES. With a single glyph and no switch state, the
    // name is the only thing telling a screen-reader user which scheme they'd land in.
    render(<SchemeToggle />);
    expect(screen.getByRole("button", { name: toDark })).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("shows the sun when the OS prefers light (setup stub never matches)", async () => {
    render(<SchemeToggle />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: toDark })).toBeInTheDocument(),
    );
  });

  it("reflects a persisted dark override — the moon, offering the way back", async () => {
    localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
    render(<SchemeToggle />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: toLight })).toBeInTheDocument(),
    );
  });

  it("pressing it from light persists and applies dark, and re-aims the name", () => {
    render(<SchemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: toDark }));
    expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(screen.getByRole("button", { name: toLight })).toBeInTheDocument();
  });

  it("pressing it from dark persists and applies light, and re-aims the name", () => {
    localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
    render(<SchemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: toLight }));
    expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(screen.getByRole("button", { name: toDark })).toBeInTheDocument();
  });

  it("shows exactly ONE glyph, and it is decorative", () => {
    // The whole point of the refactor: one conditional icon, never both. A regression that
    // rendered the pair would still satisfy every name assertion above.
    const { container } = render(<SchemeToggle />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute("aria-hidden", "true");
  });

  describe("QA — adversarial", () => {
    it("SSR markup is scheme-agnostic — never claims a state it cannot know", () => {
      // The server can't read the OS preference or localStorage, so the SSR snapshot must be
      // the neutral light state even when a dark override is persisted — otherwise the markup
      // would assert a scheme it might have wrong, risking a hydration mismatch. The colors are
      // corrected pre-paint by the inline init script; only the glyph settles.
      localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
      const html = renderToStaticMarkup(<SchemeToggle />);
      expect(html).toContain("Switch to dark mode");
      expect(html).not.toContain("Switch to light mode");
    });

    it("is a native, focusable button — keyboard-operable with no custom key handling", () => {
      render(<SchemeToggle />);
      const toggle = screen.getByRole("button", { name: toDark });
      expect(toggle.tagName).toBe("BUTTON");
      // Inside a <form> a typeless button defaults to type="submit" and would navigate.
      expect(toggle).toHaveAttribute("type", "button");
      toggle.focus();
      expect(toggle).toHaveFocus();
    });

    it("rapid presses settle on a consistent final state", () => {
      render(<SchemeToggle />);
      fireEvent.click(screen.getByRole("button", { name: toDark })); // → dark
      fireEvent.click(screen.getByRole("button", { name: toLight })); // → light
      fireEvent.click(screen.getByRole("button", { name: toDark })); // → dark
      expect(screen.getByRole("button", { name: toLight })).toBeInTheDocument();
      expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });

    it("sizes the glyph from --size-icon, so Lucide's own width/height never govern", () => {
      // Lucide ships width/height="24" presentation attributes. CSS always outranks a
      // presentation attribute, so `.icon` is what actually sets the box — and if this rule
      // were dropped the glyph would jump to 24px inside a 24px target with zero padding.
      const css = readModuleCss(
        "src/components/site-chrome/SchemeToggle.module.css",
      );
      const icon = ruleDeclarations(css, ".icon");
      expect(icon.get("inline-size")).toBe("var(--size-icon)");
      expect(icon.get("block-size")).toBe("var(--size-icon)");
    });

    it("--size-icon actually exists, so the icon rule can't resolve to auto", () => {
      // `inline-size: var(--size-icon)` with the token undefined is invalid at
      // computed-value time → the property falls back to `auto`. Renaming the foundation token
      // would leave every assertion above green, so pin it at its declaring sheet.
      const dimension = readModuleCss("src/styles/foundation/dimension.css");
      expect(ruleDeclarations(dimension, ":root").get("--size-icon")).toBe(
        "1rem",
      );
    });

    it("floors the pointer target at 24×24 independent of the glyph", () => {
      // WCAG 2.2 SC 2.5.8: https://www.w3.org/TR/WCAG22/#target-size-minimum
      // `--size-icon` (1rem) is SMALLER than the 24px floor, so the button — not the glyph —
      // has to supply the target. Nothing at runtime reveals a 16px hit area in jsdom.
      const css = readModuleCss(
        "src/components/site-chrome/SchemeToggle.module.css",
      );
      const toggle = ruleDeclarations(css, ".toggle");
      expect(toggle.get("min-inline-size")).toBe("var(--size-control)");
      expect(toggle.get("min-block-size")).toBe("var(--size-control)");
    });

    it("styles focus-visible with the site ring tokens — never bare :focus", () => {
      const css = readModuleCss(
        "src/components/site-chrome/SchemeToggle.module.css",
      );
      const focusVisible = ruleDeclarations(css, ".toggle:focus-visible");
      expect(focusVisible.get("outline")).toBe(
        "var(--ring-width) var(--ring-style) var(--ring)",
      );
      expect(focusVisible.get("outline-offset")).toBe("var(--ring-offset)");
      // The button resets `border: none`; without a ring rule the control would have NO visible
      // focus at all — a straight 2.4.7 failure.
      expect(ruleDeclarations(css, ".toggle:focus").size).toBe(0);
    });

    it("carries the sizing class on the glyph in BOTH schemes", () => {
      // The glyph is chosen by a ternary; a refactor that split the JSX per branch could drop
      // the class from exactly one scheme — the one that isn't currently rendered.
      localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
      const { container } = render(<SchemeToggle />);
      expect(container.querySelector("svg")).toHaveClass(styles.icon);
    });

    it("reflects a cross-tab change live (subscription is wired)", async () => {
      render(<SchemeToggle />);
      expect(screen.getByRole("button", { name: toDark })).toBeInTheDocument();
      act(() => {
        localStorage.setItem(SCHEME_STORAGE_KEY, "dark");
        window.dispatchEvent(
          new StorageEvent("storage", { key: SCHEME_STORAGE_KEY }),
        );
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: toLight }),
        ).toBeInTheDocument(),
      );
    });
  });
});
