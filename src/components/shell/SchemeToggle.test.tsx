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
