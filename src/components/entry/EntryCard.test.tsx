import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryCard, { type EntryCardEntry } from "./EntryCard";

function entry(over: Partial<EntryCardEntry> = {}): EntryCardEntry {
  return {
    title: "A card",
    slug: "a-card",
    summary: "A short summary.",
    kind: "demo",
    stage: "prototype",
    iterated: null,
    linkCount: null,
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
  it("links the title to the entry's flat /[slug] and shows the summary", () => {
    renderCard(entry());
    const link = screen.getByRole("link", { name: /a card/i });
    expect(link).toHaveAttribute("href", "/a-card");
    expect(screen.getByText("A short summary.")).toBeInTheDocument();
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

  it("omits the summary paragraph when there is none", () => {
    renderCard(entry({ summary: null }));
    expect(screen.queryByText("A short summary.")).toBeNull();
  });

  it("omits the summary paragraph for an empty string, not just null — no empty <p> in the card", () => {
    // A blank Studio field serialises to "" (a valid string); the truthiness guard must
    // treat it as missing rather than render an empty paragraph between title and meta.
    const { container } = renderCard(entry({ summary: "" }));
    expect(container.querySelectorAll("p")).toHaveLength(1); // the meta readout only
  });

  it("renders the full mono meta readout: kind · stage · iterated · linked", () => {
    renderCard(
      entry({
        kind: "demo",
        stage: "shipped",
        iterated: "2026-07-16",
        linkCount: 2,
      }),
    );
    expect(screen.getByText("demo")).toBeInTheDocument();
    expect(screen.getByText("shipped")).toBeInTheDocument();
    const time = screen.getByText("iterated July 16, 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-07-16");
    expect(screen.getByText("2 linked")).toBeInTheDocument();
  });

  it("shows only what it has when part of the meta is missing", () => {
    renderCard(entry({ kind: null, stage: "sketch" }));
    expect(screen.getByText("sketch")).toBeInTheDocument();
  });

  it("omits the meta row entirely when no fact is present", () => {
    const { container } = renderCard(entry({ kind: null, stage: null }));
    // Title still renders; nothing left to read out.
    expect(
      screen.getByRole("heading", { level: 3, name: /a card/i }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain("·");
    expect(container.querySelector('[data-variant="meta"]')).toBeNull();
  });

  it("carries no inline theme — the plate reads the page's ambient tokens (one seed paints a page)", () => {
    renderCard(entry());
    expect(screen.getByRole("listitem").getAttribute("style")).toBeNull();
  });
});

describe("EntryCard — title/slug boundaries", () => {
  // `title ?? "Untitled entry"` is nullish — a blank Studio field serialises to "" (a valid
  // string) and would slip through to a nameless <h3> (axe empty-heading) with the link's
  // accessible name silently degrading to the summary. These pin the blank cases.
  it("falls back to a neutral label for an empty-string title (not an empty heading)", () => {
    renderCard(entry({ title: "" }));
    expect(screen.getByRole("heading", { level: 3 })).toHaveAccessibleName(
      /untitled entry/i,
    );
  });

  it("falls back to a neutral label for a whitespace-only title", () => {
    renderCard(entry({ title: "   " }));
    expect(
      screen.getByRole("heading", { level: 3 }).textContent?.trim(),
    ).not.toBe("");
  });

  // An empty-string slug is falsy, so it must degrade to the non-link plate — never href="/".
  it("renders an empty-string slug as a non-link plate, never href='/'", () => {
    renderCard(entry({ slug: "" }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: /a card/i }),
    ).toBeInTheDocument();
  });
});
