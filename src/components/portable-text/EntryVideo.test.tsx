import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryVideo from "./EntryVideo";

describe("EntryVideo", () => {
  it("labels the placeholder with the caption when present", () => {
    const { container } = render(
      <EntryVideo
        value={{ url: "https://example.com/v.mp4", caption: "A demo reel" }}
      />,
    );
    // The caption is both the accessible label of the placeholder and the visible figcaption.
    expect(
      screen.getByRole("img", { name: "A demo reel" }),
    ).toBeInTheDocument();
    expect(container.querySelector("figcaption")).toHaveTextContent(
      "A demo reel",
    );
  });

  it("falls back to a generic label and no figcaption when uncaptioned", () => {
    const { container } = render(
      <EntryVideo value={{ url: "https://example.com/v.mp4" }} />,
    );
    expect(screen.getByRole("img", { name: "Video" })).toBeInTheDocument();
    expect(container.querySelector("figcaption")).toBeNull();
  });

  // Total at the seam: a `video` block whose required URL was dropped by a raw API write
  // must still render (the placeholder), never crash the article.
  it("does not crash when the URL is absent", () => {
    expect(() => render(<EntryVideo value={{}} />)).not.toThrow();
    expect(screen.getByRole("img", { name: "Video" })).toBeInTheDocument();
  });
});
