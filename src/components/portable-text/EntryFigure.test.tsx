import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import EntryFigure from "./EntryFigure";

type FigureValue = Parameters<typeof EntryFigure>[0]["value"];

describe("EntryFigure", () => {
  it("names the placeholder with the alt text and shows the caption", () => {
    const { container } = render(
      <EntryFigure value={{ alt: "A wide diagram", caption: "Fig. 1" }} />,
    );
    expect(
      screen.getByRole("img", { name: "A wide diagram" }),
    ).toBeInTheDocument();
    expect(container.querySelector("figcaption")).toHaveTextContent("Fig. 1");
  });

  // The caption is the figcaption, not a fallback for the accessible name — so it is never
  // announced twice. A figure with a caption but no alt keeps the generic accessible name.
  it("labels the box generically when there is no alt, caption in the figcaption", () => {
    const { container } = render(
      <EntryFigure value={{ caption: "Just a caption" }} />,
    );
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
    expect(container.querySelector("figcaption")).toHaveTextContent(
      "Just a caption",
    );
    expect(screen.getAllByText("Just a caption")).toHaveLength(1);
  });

  it("uses the generic label when neither alt nor caption is present", () => {
    const { container } = render(<EntryFigure value={{}} />);
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
    expect(container.querySelector("figcaption")).toBeNull();
  });

  // The guard against the `??`-empty-string a11y bug: an empty (or whitespace-only) alt from a
  // raw API write must not leave the placeholder's role="img" with a blank accessible name —
  // it falls back to the generic kind.
  it("never leaves an empty accessible name for an empty-string alt", () => {
    render(<EntryFigure value={{ alt: "", caption: "A caption" }} />);
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
  });

  it("falls back to the generic label when alt and caption are both empty", () => {
    render(<EntryFigure value={{ alt: "", caption: "" }} />);
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
  });

  // Shape drift, not just missing fields: a raw Content Lake write can put any JSON where the alt
  // string should be. A non-string alt reaches `firstNonEmpty` → `isNonBlank` and must be skipped
  // (box falls back to the generic name), never `.trim()`-thrown and crash the article.
  it("survives an alt drifted to a non-string shape", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const drifted = {
      alt: { en: "A diagram" },
      caption: "Fig. 1",
    } as unknown as FigureValue;
    expect(() => render(<EntryFigure value={drifted} />)).not.toThrow();
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
    spy.mockRestore();
  });

  // Adapter contract: an image has no fixed aspect ratio, so the figure branch passes NO ratio
  // — the box gets no ratio custom property (its height floor is the min-block-size).
  it("renders a variable-ratio box — no aspect-ratio custom property", () => {
    render(<EntryFigure value={{ alt: "A diagram" }} />);
    const box = screen.getByRole("img", { name: "A diagram" });
    expect(box.style.getPropertyValue("--placeholder-ratio")).toBe("");
  });
});
