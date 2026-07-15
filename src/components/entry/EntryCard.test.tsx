import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryCard, { type EntryCardEntry } from "./EntryCard";

function entry(over: Partial<EntryCardEntry> = {}): EntryCardEntry {
  return {
    title: "A card",
    slug: "a-card",
    summary: "A short summary.",
    stage: "prototype",
    themeSeed: "oklch(0.7 0.15 70)",
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

  it("renders the mono meta readout: maturity stage · the resolved OKLCH seed", () => {
    renderCard(entry({ stage: "shipped", themeSeed: "oklch(0.6 0.2 260)" }));
    expect(
      screen.getByText("shipped · oklch(0.6 0.2 260)"),
    ).toBeInTheDocument();
  });

  it("shows only what it has when part of the meta is missing", () => {
    renderCard(entry({ stage: "sketch", themeSeed: null }));
    expect(screen.getByText("sketch")).toBeInTheDocument();
  });

  it("omits the meta row entirely when there is no stage or seed", () => {
    const { container } = renderCard(entry({ stage: null, themeSeed: null }));
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

  it("survives a null / garbage themeSeed via the engine fallback (never throws)", () => {
    expect(() => renderCard(entry({ themeSeed: null }))).not.toThrow();
    expect(() => renderCard(entry({ themeSeed: "not-a-color" }))).not.toThrow();
  });

  it("survives an absent seed (an unauthored site default leaves the chain empty)", () => {
    // The resolved seed is null only when NOTHING in the chain is authored — the card must
    // fall back to the engine palette, omit the color from the meta readout, and never crash.
    renderCard(entry({ stage: "shipped", themeSeed: null }));
    expect(screen.getByText("shipped")).toBeInTheDocument();
    const style = screen.getByRole("listitem").getAttribute("style") ?? "";
    expect(style).toContain("--accent");
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

describe("EntryCard — malformed seed shapes (QA #249)", () => {
  // The type contract says `string | null`, but the card renders live/draft data — a raw API
  // write can hand it shapes the type forbids. cardSwatches' totality must absorb them all:
  // render, bake a fallback palette, never throw.
  it("survives a NON-STRING themeSeed (number / object) via the engine fallback", () => {
    expect(() =>
      renderCard(
        entry({ themeSeed: 123 as unknown as EntryCardEntry["themeSeed"] }),
      ),
    ).not.toThrow();
    expect(() =>
      renderCard(
        entry({
          themeSeed: { seed: "#fff" } as unknown as EntryCardEntry["themeSeed"],
        }),
      ),
    ).not.toThrow();
  });

  it("keeps a hostile themeSeed string inert in the mono readout (rendered as text, palette falls back)", () => {
    renderCard(
      entry({
        stage: "shipped",
        themeSeed: '"><img src=x onerror=alert(1)>',
      }),
    );
    // React escapes by construction — assert the value surfaced as TEXT, not markup.
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(
      screen.getByText(/shipped · "><img src=x onerror=alert\(1\)>/),
    ).toBeInTheDocument();
  });
});
