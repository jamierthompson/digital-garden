import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Wordmark from "./Wordmark";

describe("Wordmark", () => {
  it("renders the home link with the accessible name 'folio' (cursor excluded)", () => {
    render(<Wordmark />);
    // The decorative `_` is aria-hidden, so AT hears exactly "folio" — a cursor leaking into
    // the name would read as "folio _" on every page.
    const link = screen.getByRole("link", { name: "folio" });
    expect(link).toHaveAttribute("href", "/");
    // The wordmark is unique chrome with self-owned ink — deliberately NOT a TextLink variant.
    expect(link).not.toHaveAttribute("data-variant");
  });

  it("keeps the blinking-cursor glyph hidden from assistive tech", () => {
    render(<Wordmark />);
    expect(screen.getByText("_")).toHaveAttribute("aria-hidden", "true");
  });
});
