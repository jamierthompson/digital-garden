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

  // QA — DEFECT: `label = value.caption ?? "Video"` uses `??`, which only substitutes for
  // null/undefined. An empty-string caption (a raw API write, or an emptied field) is a
  // string, so it is NOT replaced — the placeholder gets `aria-label=""`, an EMPTY accessible
  // name on a role="img" element (WCAG 2.2 SC 1.1.1). The author's own "labelled placeholder"
  // contract wants the "Video" fallback here. Fix: use `||`, or guard the empty string.
  it("falls back to the generic label when the caption is an empty string", () => {
    const { container } = render(
      <EntryVideo value={{ url: "https://example.com/v.mp4", caption: "" }} />,
    );
    expect(screen.getByRole("img", { name: "Video" })).toBeInTheDocument();
    // An empty caption is not a real caption — no figcaption is emitted for it.
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

  // Adapter contract: the video branch is video-shaped NOW so the eventual embed lands
  // without layout shift (#128) — a 16:9 Radix AspectRatio box (padding-bottom 56.25%).
  it("holds the placeholder in a 16:9 AspectRatio box", () => {
    const { container } = render(<EntryVideo value={{ caption: "A reel" }} />);
    const wrapper = container.querySelector<HTMLElement>(
      "[data-radix-aspect-ratio-wrapper]",
    );
    expect(wrapper).not.toBeNull();
    expect(wrapper!.style.paddingBottom).toBe("56.25%");
  });
});
