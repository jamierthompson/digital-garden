import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});
