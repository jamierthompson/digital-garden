import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryCard, { type EntryCardEntry } from "./EntryCard";

function entry(over: Partial<EntryCardEntry> = {}): EntryCardEntry {
  return {
    title: "A card",
    slug: "a-card",
    blurb: "A short blurb.",
    stage: "prototype",
    themeColor: "oklch(0.7 0.15 70)",
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
    renderCard(entry({ stage: "shipped", themeColor: "oklch(0.6 0.2 260)" }));
    expect(
      screen.getByText("shipped · oklch(0.6 0.2 260)"),
    ).toBeInTheDocument();
  });

  it("shows only what it has when part of the meta is missing", () => {
    renderCard(entry({ stage: "sketch", themeColor: null }));
    expect(screen.getByText("sketch")).toBeInTheDocument();
  });

  it("omits the meta row entirely when there is no stage or seed", () => {
    const { container } = renderCard(entry({ stage: null, themeColor: null }));
    // Title still renders; nothing left to read out.
    expect(
      screen.getByRole("heading", { level: 3, name: /a card/i }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain("·");
  });

  it("bakes its theme palette inline, incl. the plate's contrast pair (--accent + --accent-foreground)", () => {
    renderCard(entry());
    const style = screen.getByRole("listitem").getAttribute("style") ?? "";
    expect(style).toContain("--accent");
    expect(style).toContain("--accent-foreground");
  });

  it("survives a null / garbage themeColor via the engine fallback (never throws)", () => {
    expect(() => renderCard(entry({ themeColor: null }))).not.toThrow();
    expect(() =>
      renderCard(entry({ themeColor: "not-a-color" as string })),
    ).not.toThrow();
  });
});

describe("EntryCard — title/slug boundaries", () => {
  // `title ?? "Untitled entry"` is nullish — a blank Studio field serialises to "" (a valid
  // string) and would slip through to a nameless <h3> (axe empty-heading) with the link's
  // accessible name silently degrading to the blurb. These pin the blank cases.
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
