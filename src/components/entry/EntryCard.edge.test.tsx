import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryCard, { type EntryCardEntry } from "./EntryCard";
import { FEATURED_QUERY } from "@/sanity/lib/queries";

/**
 * Adversarial edges for the neutral-surface `EntryCard` (QA, independent of the slice).
 *
 * The refactor deleted the card's inline-theme path and, with it, the tests that exercised the
 * card against hostile data (the old `themeSeed` totality suite). Those cases were about a field
 * that no longer exists — but the card still renders LIVE, draft, partially-authored content,
 * and the remaining fields have their own boundaries. These pin them.
 */

function entry(over: Partial<EntryCardEntry> = {}): EntryCardEntry {
  return {
    title: "A card",
    slug: "a-card",
    summary: null,
    kind: "demo",
    stage: "prototype",
    iterated: null,
    linkCount: null,
    ...over,
  };
}

function renderCard(e: EntryCardEntry) {
  return render(
    <ul>
      <EntryCard entry={e} />
    </ul>,
  );
}

describe("EntryCard — the query is the card's real input", () => {
  it("FEATURED_QUERY projects every field EntryCardEntry requires", () => {
    // The slice dropped `themeSeed` from the projection. A card field that the query does NOT
    // project arrives as `undefined` at runtime even though the TS type says `T | null` — the
    // failure the type system cannot see, because the generated result type is what TS checks
    // and hand-written fixtures always supply the field. Assert against the QUERY TEXT.
    const projected = FEATURED_QUERY as unknown as string;
    for (const field of [
      "_id",
      "title",
      "slug",
      "kind",
      "stage",
      "iterated",
      "summary",
      "linkCount",
    ]) {
      expect(projected).toContain(field);
    }
  });

  it("no longer projects the retired themeSeed (one seed paints a page)", () => {
    expect(FEATURED_QUERY as unknown as string).not.toContain("themeSeed");
  });

  it("renders from a row whose optional fields are ABSENT, not null", () => {
    // GROQ omits nothing here, but a draft/partial document can still yield undefined for an
    // unauthored field. The card must degrade, never crash.
    const sparse = { title: "Sparse", slug: "sparse" };
    expect(() => renderCard(sparse as unknown as EntryCardEntry)).not.toThrow();
    expect(screen.getByRole("link", { name: /sparse/i })).toBeInTheDocument();
  });
});

describe("EntryCard — title & slug boundaries", () => {
  it("falls back to a named heading for a whitespace-only title", () => {
    renderCard(entry({ title: "   " }));
    expect(
      screen.getByRole("heading", { level: 3, name: "Untitled entry" }),
    ).toBeInTheDocument();
  });

  it("falls back for a null title rather than rendering a nameless link", () => {
    renderCard(entry({ title: null }));
    const link = screen.getByRole("link");
    expect(link.textContent).toContain("Untitled entry");
  });

  it("degrades a slugless card to a non-link — never a dead href", () => {
    const { container } = renderCard(entry({ slug: null }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("a[href]")).toBeNull();
    // Still a real list item carrying the heading, so the grid's outline stays intact.
    expect(
      screen.getByRole("heading", { level: 3, name: /a card/i }),
    ).toBeInTheDocument();
  });

  it("treats an empty-string slug as slugless, not as a link to /", () => {
    // `entry.slug ? …` — an empty string is falsy, so this SHOULD degrade. Pinned because a
    // switch to `slug != null` would silently ship links pointing at the site root.
    renderCard(entry({ slug: "" }));
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("EntryCard — meta boundaries", () => {
  it("omits the backlink hint for zero, negative and non-integer link counts", () => {
    for (const linkCount of [0, -3, 1.5, Number.NaN]) {
      const { unmount } = renderCard(entry({ linkCount }));
      expect(screen.queryByText(/linked$/)).toBeNull();
      unmount();
    }
  });

  it("renders the hint for a positive count", () => {
    renderCard(entry({ linkCount: 2 }));
    expect(screen.getByText("2 linked")).toBeInTheDocument();
  });

  it("does not render an empty summary paragraph for a blank summary", () => {
    const { container } = renderCard(entry({ summary: "" }));
    // Only the meta readout should be a <p>; a blank summary must not add a second one.
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});

describe("EntryCard — the neutral surface carries no baked theme", () => {
  it("bakes no inline style on the card or on any descendant", () => {
    // The slice's headline claim. The author pins the <li>; a re-bind could just as easily
    // reappear on the link or the heading, so sweep the whole subtree.
    const { container } = renderCard(entry({ summary: "s", linkCount: 4 }));
    const styled = [...container.querySelectorAll("[style]")];
    expect(styled.map((el) => el.outerHTML)).toEqual([]);
  });

  it("declares no ink of its own on the title — it inherits --foreground", () => {
    // The card comment says the title "inherits --foreground": no data-color on the h3.
    renderCard(entry());
    expect(screen.getByRole("heading", { level: 3 })).not.toHaveAttribute(
      "data-color",
    );
  });

  it("wears muted ink on the summary and the meta readout", () => {
    const { container } = renderCard(entry({ summary: "A summary." }));
    expect(screen.getByText("A summary.")).toHaveAttribute(
      "data-color",
      "muted-foreground",
    );
    expect(container.querySelector('[data-variant="meta"]')).toHaveAttribute(
      "data-color",
      "muted-foreground",
    );
  });
});
