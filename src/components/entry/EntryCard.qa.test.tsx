import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryCard, { type EntryCardEntry } from "./EntryCard";

/**
 * QA-added edge cases (independent adversarial pass) — the boundaries the author's suite
 * optimised past. The component advertises: "a missing title falls back to a neutral label."
 * These pin the inputs where "missing" is not literally `null`.
 */

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

function renderCard(data: EntryCardEntry) {
  return render(
    <ul>
      <EntryCard entry={data} />
    </ul>,
  );
}

describe("EntryCard — title fallback boundaries (QA)", () => {
  // DEFECT: `entry.title ?? "Untitled entry"` is NULLISH — it only catches null/undefined.
  // An empty-string title (a valid `string`, and what a blank Studio field can serialise to)
  // slips through and renders an EMPTY <h3>: a nameless heading in the document outline
  // (axe `empty-heading`) and a link whose accessible name silently degrades to the blurb.
  it("falls back to a neutral label for an empty-string title (not an empty heading)", () => {
    renderCard(entry({ title: "" }));
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveAccessibleName(/untitled entry/i);
  });

  it("falls back to a neutral label for a whitespace-only title", () => {
    renderCard(entry({ title: "   " }));
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.textContent?.trim()).not.toBe("");
  });
});

describe("EntryCard — slug boundaries (QA)", () => {
  // Correct-behaviour lock: an empty-string slug is falsy, so it must degrade to the
  // non-link plate (never `href="/"`, a dead link back to home).
  it("renders an empty-string slug as a non-link plate, never href='/'", () => {
    renderCard(entry({ slug: "" }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: /a card/i }),
    ).toBeInTheDocument();
  });
});
