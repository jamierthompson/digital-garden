import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  readModuleCss,
  referencedCustomProperties,
  ruleDeclarations,
} from "../../../tests/cssModule";

import RelatedEntries from "./RelatedEntries";

const entry = (over: Record<string, unknown> = {}) => ({
  _id: "x",
  title: "Title",
  slug: "some-slug",
  kind: "note",
  summary: null,
  ...over,
});

describe("RelatedEntries", () => {
  it("renders nothing when there are no related entries or backlinks", () => {
    const { container: nullContainer } = render(
      <RelatedEntries currentId="self" related={null} backlinks={null} />,
    );
    expect(nullContainer).toBeEmptyDOMElement();

    const { container: emptyContainer } = render(
      <RelatedEntries currentId="self" related={[]} backlinks={[]} />,
    );
    expect(emptyContainer).toBeEmptyDOMElement();
  });

  it("renders the union of related + backlinks as links, de-duped by _id", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "a", title: "On gardens", slug: "on-gardens" })]}
        backlinks={[
          entry({ _id: "b", title: "On OKLCH", slug: "on-oklch" }),
          entry({ _id: "a", title: "On gardens", slug: "on-gardens" }), // duplicate of the related edge
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /related/i }),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["On gardens", "On OKLCH"]);
    expect(links[0]).toHaveAttribute("href", "/on-gardens");
  });

  it("excludes a self-reference by _id", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "self", title: "Me", slug: "me" })]}
        backlinks={null}
      />,
    );
    expect(screen.queryByText("Me")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /related/i }),
    ).not.toBeInTheDocument();
  });

  it("filters out a dangling reference (a null element from a deleted target)", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[null, entry({ _id: "a", title: "Live", slug: "live" })]}
        backlinks={null}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Live"]);
  });

  it("renders an entry with no slug as plain text, not a dead link", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "a", title: "No route", slug: null })]}
        backlinks={null}
      />,
    );
    expect(screen.getByText("No route")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("falls back to a neutral label for an untitled entry", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "a", title: null, slug: "x" })]}
        backlinks={null}
      />,
    );
    expect(screen.getByText("Untitled entry")).toBeInTheDocument();
  });

  it("excludes a self-reference that arrives via backlinks, not just related", () => {
    // `references(^._id)` returns the current doc itself if it self-references, so the
    // self-exclusion has to cover the backlinks arm too — not only the outgoing `related`.
    render(
      <RelatedEntries
        currentId="self"
        related={null}
        backlinks={[entry({ _id: "self", title: "Me", slug: "me" })]}
      />,
    );
    expect(screen.queryByText("Me")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /related/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the outgoing `related` edge when the same _id appears in both arms (related wins, stable order)", () => {
    // The two arms dereference the same doc, so a real divergence is unlikely — but the
    // de-dupe MUST be deterministic: `related` is tended first, so its copy wins and it
    // keeps its position ahead of the backlink-only entries.
    render(
      <RelatedEntries
        currentId="self"
        related={[
          entry({ _id: "a", title: "From related", slug: "from-related" }),
        ]}
        backlinks={[
          entry({ _id: "a", title: "From backlink", slug: "from-backlink" }),
          entry({ _id: "b", title: "Backlink only", slug: "backlink-only" }),
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "From related",
      "Backlink only",
    ]);
    expect(links[0]).toHaveAttribute("href", "/from-related");
    expect(screen.queryByText("From backlink")).not.toBeInTheDocument();
  });

  it("filters a dangling null element interleaved in the backlinks arm", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={null}
        backlinks={[
          entry({ _id: "a", title: "Live one", slug: "live-one" }),
          null,
          entry({ _id: "b", title: "Live two", slug: "live-two" }),
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Live one", "Live two"]);
  });

  it("renders nothing when every candidate is filtered out across both arms", () => {
    // A ragged graph: outgoing edge is a deleted target (null), the only incoming edge is
    // the doc itself. Nothing survives → no empty "Related" heading.
    const { container } = render(
      <RelatedEntries
        currentId="self"
        related={[null]}
        backlinks={[entry({ _id: "self", title: "Me", slug: "me" })]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("scopes the Related heading's id to the entry's own _id, so two instances rendered together (Cache Components' Activity keeps several /[slug] routes mounted at once) never collide", () => {
    render(
      <>
        <RelatedEntries
          currentId="entry-a"
          related={[entry({ _id: "x", title: "X", slug: "x" })]}
          backlinks={null}
        />
        <RelatedEntries
          currentId="entry-b"
          related={[entry({ _id: "y", title: "Y", slug: "y" })]}
          backlinks={null}
        />
      </>,
    );
    const headings = screen.getAllByRole("heading", { name: /related/i });
    expect(headings).toHaveLength(2);
    const ids = headings.map((h) => h.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every(Boolean)).toBe(true);
  });

  it("renders 'Related' as a real level-2 heading (label variant styles type, not outline)", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "a", title: "On gardens", slug: "on-gardens" })]}
        backlinks={null}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: /related/i });
    expect(heading.tagName).toBe("H2");
    const section = heading.closest("section");
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
    expect(heading.id).not.toBe("");
  });

  it("preserves related-before-backlinks order with multiple entries in each arm", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[
          entry({ _id: "r1", title: "Related one", slug: "r1" }),
          entry({ _id: "r2", title: "Related two", slug: "r2" }),
        ]}
        backlinks={[
          entry({ _id: "b1", title: "Backlink one", slug: "b1" }),
          entry({ _id: "b2", title: "Backlink two", slug: "b2" }),
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Related one",
      "Related two",
      "Backlink one",
      "Backlink two",
    ]);
  });

  it("shows each entry's kind beside its title, outside the link's accessible name", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "a", title: "On gardens", slug: "on-gardens" })]}
        backlinks={[
          entry({
            _id: "b",
            title: "On OKLCH",
            slug: "on-oklch",
            kind: "essay",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Essay")).toBeInTheDocument();
    // The kind is a meta label next to the link, not part of the link text itself.
    expect(screen.getByRole("link", { name: "On gardens" }).textContent).toBe(
      "On gardens",
    );
    expect(screen.getByText("Note").closest("p")).toHaveAttribute(
      "data-variant",
      "meta",
    );
  });

  it("renders each entry's summary continuing its title, with the link naming only the title", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[
          entry({
            _id: "a",
            title: "One seed color in.",
            slug: "oklch",
            summary: "The engine solves the whole ramp.",
          }),
        ]}
        backlinks={null}
      />,
    );
    // The whole row reads as one paragraph — title (run-in), then the summary continuing it.
    expect(
      screen.getByText("The engine solves the whole ramp."),
    ).toBeInTheDocument();
    // …but the link's accessible name is the title alone, not the summary.
    expect(
      screen.getByRole("link", { name: "One seed color in." }),
    ).toHaveAttribute("href", "/oklch");
  });

  it("renders each row title as a level-3 heading under the level-2 'Related' heading", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[
          entry({ _id: "a", title: "Row one", slug: "r1" }),
          entry({ _id: "b", title: "Row two", slug: "r2" }),
        ]}
        backlinks={null}
      />,
    );
    // The outline holds end-to-end: one h2 section heading, one h3 per row.
    expect(
      screen.getByRole("heading", { level: 2, name: /related/i }),
    ).toBeInTheDocument();
    const rowHeadings = screen.getAllByRole("heading", { level: 3 });
    expect(rowHeadings.map((h) => h.textContent)).toEqual([
      "Row one",
      "Row two",
    ]);
  });

  it("names the link with the neutral fallback for an untitled entry — no nameless link", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[
          entry({ _id: "a", title: null, slug: "untitled" }),
          entry({ _id: "b", title: "   ", slug: "blank" }),
        ]}
        backlinks={null}
      />,
    );
    // null AND whitespace-only titles both resolve to the fallback as the ACCESSIBLE name.
    const links = screen.getAllByRole("link", { name: "Untitled entry" });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/untitled",
      "/blank",
    ]);
  });

  it("renders an empty-string slug as plain text end-to-end — no dead link to '/'", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "a", title: "No route", slug: "" })]}
        backlinks={null}
      />,
    );
    expect(screen.getByText("No route")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the link name unambiguous when an entry's summary repeats its title", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[
          entry({
            _id: "a",
            title: "Echo.",
            slug: "echo",
            summary: "Echo.",
          }),
        ]}
        backlinks={null}
      />,
    );
    const link = screen.getByRole("link", { name: "Echo." });
    expect(link.textContent).toBe("Echo.");
    expect(link).toHaveAttribute("href", "/echo");
  });

  it("renders no kind label for a kindless (drifted) entry — title only, no stray meta row", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[
          entry({ _id: "a", title: "Kindless", slug: "k", kind: null }),
        ]}
        backlinks={null}
      />,
    );
    expect(screen.getByRole("listitem").textContent).toBe("Kindless");
  });
});

describe("the label's ink travels via the color prop, not CSS", () => {
  // The `.heading { color: … }` rule was deleted in favour of `color="muted-foreground"` on
  // the Heading primitive. Ink stated in BOTH places is the drift this guards: the CSS module
  // would win at equal layer and silently override the prop the component reads. Pinned at
  // the CSS source (jsdom loads no stylesheets); commented-out declarations don't count.
  const RELATED_CSS = readModuleCss(
    "src/components/entry/RelatedEntries.module.css",
  );

  it("declares no ink on the label and references no accent token", () => {
    expect(ruleDeclarations(RELATED_CSS, ".heading").size).toBe(0);
    expect(
      [...referencedCustomProperties(RELATED_CSS)].filter((v) =>
        v.includes("accent"),
      ),
    ).toEqual([]);
    // The module's remaining ink (`.item { color: var(--foreground) }`) is the list's own
    // body ink and is deliberately in scope for CSS; only the LABEL moved to the prop.
    expect(ruleDeclarations(RELATED_CSS, ".item").get("color")).toBe(
      "var(--foreground)",
    );
  });

  it("owns the summary trim here — the one surface that clamps (the atom itself is trim-agnostic)", () => {
    // The clamp is passed to EntryTeaser as a className, so the atom stays trim-free and every
    // other teaser surface shows the full summary. Guard that the clamp lives in THIS module —
    // value-agnostic, because the line count is a live-tuned knob.
    const clamp = ruleDeclarations(RELATED_CSS, ".teaserClamp");
    expect(clamp.has("line-clamp") || clamp.has("-webkit-line-clamp")).toBe(
      true,
    );
    expect(clamp.get("overflow")).toBe("hidden");
  });
});
