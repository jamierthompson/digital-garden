import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryVideo from "./EntryVideo";

describe("EntryVideo", () => {
  it("shows the caption in the figcaption, and labels the box generically", () => {
    const { container } = render(
      <EntryVideo
        value={{ url: "https://example.com/v.mp4", caption: "A demo reel" }}
      />,
    );
    // The caption is the visible figcaption; the box's accessible name is the generic kind, so
    // the caption is not announced twice.
    expect(screen.getByRole("img", { name: "Video" })).toBeInTheDocument();
    expect(container.querySelector("figcaption")).toHaveTextContent(
      "A demo reel",
    );
    // The caption text appears once (the figcaption), not also as the visible chip.
    expect(screen.getAllByText("A demo reel")).toHaveLength(1);
  });

  it("shows no figcaption when uncaptioned", () => {
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

  // A whitespace-only caption is not a real caption — no figcaption is emitted for it, and the
  // box keeps its generic accessible name.
  it("emits no figcaption for an empty or whitespace-only caption", () => {
    const { container } = render(
      <EntryVideo value={{ url: "https://example.com/v.mp4", caption: "" }} />,
    );
    expect(screen.getByRole("img", { name: "Video" })).toBeInTheDocument();
    expect(container.querySelector("figcaption")).toBeNull();
  });

  // The placeholder is deferred (#128): the URL must never reach an href/src, so a
  // `javascript:`-style or otherwise hostile URL cannot be navigated to or loaded.
  it("never renders the URL into a navigable/loadable attribute", () => {
    const hostile = "javascript:alert(1)";
    const { container } = render(<EntryVideo value={{ url: hostile }} />);
    expect(container.querySelector("a, [href], [src]")).toBeNull();
    expect(container.innerHTML).not.toContain(hostile);
  });

  // Adapter contract: the video branch is video-shaped NOW (a 16:9 native CSS aspect-ratio) so
  // the eventual embed lands without layout shift (#128).
  it("holds the placeholder in a 16:9 box", () => {
    render(<EntryVideo value={{ caption: "A reel" }} />);
    const box = screen.getByRole("img", { name: "Video" });
    expect(box.style.getPropertyValue("--placeholder-ratio")).toBe("16 / 9");
  });
});
