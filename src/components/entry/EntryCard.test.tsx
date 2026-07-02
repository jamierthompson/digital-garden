import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryCard, { type EntryCardEntry } from "./EntryCard";

function entry(over: Partial<EntryCardEntry> = {}): EntryCardEntry {
  return {
    title: "A card",
    slug: "a-card",
    blurb: "A short blurb.",
    stage: "prototype",
    brandColor: "oklch(0.7 0.15 70)",
    ...over,
  };
}

// EntryCard renders an <li>; mount inside a <ul> so the list-item semantics are valid.
function renderCard(data: EntryCardEntry) {
  return render(
    <ul>
      <EntryCard entry={data} />
    </ul>,
  );
}

describe("EntryCard", () => {
  it("links the title to the entry's flat /[slug] and shows the blurb", () => {
    renderCard(entry());
    const link = screen.getByRole("link", { name: /a card/i });
    expect(link).toHaveAttribute("href", "/a-card");
    expect(screen.getByText("A short blurb.")).toBeInTheDocument();
  });

  it("renders a slugless entry as a non-link heading, never a dead link", () => {
    renderCard(entry({ title: "No route", slug: null }));
    expect(screen.queryByRole("link", { name: /no route/i })).toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: /no route/i }),
    ).toBeInTheDocument();
  });

  it("falls back to a neutral label for an untitled entry", () => {
    renderCard(entry({ title: null, slug: "x" }));
    expect(
      screen.getByRole("link", { name: /untitled entry/i }),
    ).toBeInTheDocument();
  });

  it("omits the blurb paragraph when there is none", () => {
    renderCard(entry({ blurb: null }));
    expect(screen.queryByText("A short blurb.")).toBeNull();
  });

  it("renders the mono meta readout: maturity stage · OKLCH seed", () => {
    renderCard(entry({ stage: "shipped", brandColor: "oklch(0.6 0.2 260)" }));
    expect(
      screen.getByText("shipped · oklch(0.6 0.2 260)"),
    ).toBeInTheDocument();
  });

  it("shows only what it has when part of the meta is missing", () => {
    renderCard(entry({ stage: "sketch", brandColor: null }));
    expect(screen.getByText("sketch")).toBeInTheDocument();
  });

  it("omits the meta row entirely when there is no stage or seed", () => {
    const { container } = renderCard(entry({ stage: null, brandColor: null }));
    // Title still renders; nothing left to read out.
    expect(
      screen.getByRole("heading", { level: 3, name: /a card/i }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain("·");
  });

  it("bakes its brand palette inline, incl. the plate's contrast pair (--accent + --on-accent)", () => {
    renderCard(entry());
    const style = screen.getByRole("listitem").getAttribute("style") ?? "";
    expect(style).toContain("--accent");
    expect(style).toContain("--on-accent");
  });

  it("survives a null / garbage brandColor via the engine fallback (never throws)", () => {
    expect(() => renderCard(entry({ brandColor: null }))).not.toThrow();
    expect(() =>
      renderCard(entry({ brandColor: "not-a-color" as string })),
    ).not.toThrow();
  });
});
