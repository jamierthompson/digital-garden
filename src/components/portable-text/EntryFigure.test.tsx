import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryFigure from "./EntryFigure";

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

  it("falls back to the caption when there is no alt", () => {
    render(<EntryFigure value={{ caption: "Just a caption" }} />);
    expect(
      screen.getByRole("img", { name: "Just a caption" }),
    ).toBeInTheDocument();
  });

  it("uses the generic label when neither alt nor caption is present", () => {
    const { container } = render(<EntryFigure value={{}} />);
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
    expect(container.querySelector("figcaption")).toBeNull();
  });

  // The guard against the `??`-empty-string a11y bug: an empty (or whitespace-only) alt from a
  // raw API write must not leave the placeholder's role="img" with a blank accessible name.
  it("never leaves an empty accessible name for an empty-string alt", () => {
    render(<EntryFigure value={{ alt: "", caption: "Fallback caption" }} />);
    expect(
      screen.getByRole("img", { name: "Fallback caption" }),
    ).toBeInTheDocument();
  });

  it("falls back to the generic label when alt and caption are both empty", () => {
    render(<EntryFigure value={{ alt: "", caption: "" }} />);
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
  });
});
