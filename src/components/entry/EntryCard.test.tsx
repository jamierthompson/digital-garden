import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryCard, { type EntryCardEntry } from "./EntryCard";

function entry(over: Partial<EntryCardEntry> = {}): EntryCardEntry {
  return {
    title: "A card",
    slug: "a-card",
    blurb: "A short blurb.",
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

  it("bakes its brand palette as inline semantic-token overrides (never thrown away)", () => {
    renderCard(entry());
    const style = screen.getByRole("listitem").getAttribute("style") ?? "";
    expect(style).toContain("--surface");
    expect(style).toContain("--accent");
  });

  it("survives a null / garbage brandColor via the engine fallback (never throws)", () => {
    expect(() => renderCard(entry({ brandColor: null }))).not.toThrow();
    expect(() =>
      renderCard(entry({ brandColor: "not-a-color" as string })),
    ).not.toThrow();
  });
});
