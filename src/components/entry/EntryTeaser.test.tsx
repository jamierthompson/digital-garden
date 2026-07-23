import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { declaredProperties, readModuleCss } from "../../../tests/cssModule";

import EntryTeaser from "./EntryTeaser";

describe("EntryTeaser", () => {
  it("renders the title as a heading at the given level, linking to the flat /[slug]", () => {
    render(
      <EntryTeaser
        title="One seed color in, an entire palette out."
        summary="The engine solves the whole ramp."
        slug="oklch-engine"
        level={3}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "One seed color in, an entire palette out.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "One seed color in, an entire palette out.",
      }),
    ).toHaveAttribute("href", "/oklch-engine");
  });

  it("honours the heading level — a demo detail header is an h1", () => {
    render(
      <EntryTeaser
        title="A demo."
        summary="Its prose."
        slug="demo"
        level={1}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "A demo." }),
    ).toBeInTheDocument();
  });

  it("fuses title + summary into one paragraph, separated by a single space", () => {
    render(
      <EntryTeaser
        title="A seed color."
        summary="It paints the page."
        slug="x"
        level={3}
      />,
    );
    // The whole atom reads as one run of text — title (with its authored terminal punctuation),
    // one space, then the summary continuing it.
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.parentElement?.textContent).toBe(
      "A seed color. It paints the page.",
    );
  });

  it("renders the summary as inline body text in the muted ink role", () => {
    render(
      <EntryTeaser title="Title." summary="The summary." slug="x" level={3} />,
    );
    const summary = screen.getByText("The summary.");
    expect(summary.tagName).toBe("SPAN");
    expect(summary).toHaveAttribute("data-variant", "body");
    expect(summary).toHaveAttribute("data-color", "muted-foreground");
  });

  it("stands the run-in alone when there is no summary — just the title", () => {
    render(<EntryTeaser title="Alone." slug="x" level={3} />);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.parentElement?.textContent).toBe("Alone.");
  });

  it("renders the title as plain text when there is no slug — no dead link", () => {
    render(
      <EntryTeaser
        title="Draft."
        summary="Not linked yet."
        slug={null}
        level={3}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "Draft." }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders plain text for an empty-string slug — no dead link to '/'", () => {
    render(<EntryTeaser title="Slugless." slug="" level={3} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("falls back to a neutral title for a blank or whitespace-only title (no nameless heading)", () => {
    render(<EntryTeaser title="   " slug="x" level={3} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Untitled entry" }),
    ).toBeInTheDocument();
    // The fallback is the accessible link name, never an empty string.
    expect(
      screen.getByRole("link", { name: "Untitled entry" }),
    ).toBeInTheDocument();
  });

  it("passes className onto the root so a surface can tune the paragraph (e.g. clamp)", () => {
    render(
      <EntryTeaser
        title="T."
        summary="S."
        slug="x"
        level={3}
        className="clampme"
      />,
    );
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.parentElement).toHaveClass("clampme");
  });

  describe("adversarial QA", () => {
    it("merges the treatment onto a single anchor inside the heading — no nested/second anchor", () => {
      render(
        <EntryTeaser title="Merged." summary="S." slug="merged" level={3} />,
      );
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("data-variant", "quiet");
      expect(links[0]).toHaveAttribute("href", "/merged");
      // A heading link must stay inside the heading (it's the outline node's accessible name).
      expect(screen.getByRole("heading", { level: 3 })).toContainElement(
        links[0],
      );
    });

    it("applies an overridden link treatment", () => {
      render(
        <EntryTeaser
          title="Accented."
          slug="x"
          level={3}
          linkVariant="accent"
        />,
      );
      expect(screen.getByRole("link")).toHaveAttribute(
        "data-variant",
        "accent",
      );
    });

    it("hides the summary for an empty string, not just null", () => {
      render(<EntryTeaser title="Only title." summary="" slug="x" level={3} />);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading.parentElement?.textContent).toBe("Only title.");
    });
  });

  describe("adversarial QA — independent pass", () => {
    it("wears the composed roles: title in foreground body, never re-authored ink", () => {
      render(<EntryTeaser title="Inked." summary="S." slug="x" level={3} />);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveAttribute("data-variant", "body");
      expect(heading).toHaveAttribute("data-color", "foreground");
    });

    it("composes className with the atom's own root class — adds, never replaces", () => {
      render(
        <EntryTeaser
          title="T."
          summary="S."
          slug="x"
          level={3}
          className="clampme"
        />,
      );
      const root = screen.getByRole("heading", { level: 3 }).parentElement;
      expect(root).toHaveClass("clampme");
      // The atom's own module class must survive alongside the surface's hook.
      expect(root?.classList).toHaveLength(2);
    });

    it("keeps the link's accessible name the title alone when title and summary are identical", () => {
      render(
        <EntryTeaser title="Same." summary="Same." slug="same" level={3} />,
      );
      const link = screen.getByRole("link", { name: "Same." });
      expect(link.textContent).toBe("Same.");
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
        "Same.",
      );
      expect(
        screen.getByRole("heading", { level: 3 }).parentElement?.textContent,
      ).toBe("Same. Same.");
    });

    it("stays trim-agnostic at the source — no clamp or overflow in the atom's own module", () => {
      // The trim contract: RelatedEntries owns the clamp via className; the atom must never
      // grow one. Pinned at the CSS source (jsdom loads no stylesheets).
      const props = declaredProperties(
        readModuleCss("src/components/entry/EntryTeaser.module.css"),
      );
      expect(props.has("line-clamp")).toBe(false);
      expect(props.has("-webkit-line-clamp")).toBe(false);
      expect(props.has("overflow")).toBe(false);
    });

    // Regression guard: a whitespace-only summary ("   " — a blank Studio field with a stray
    // space) must be treated as absent, exactly like the title guard. Without the summary's
    // `.trim()` guard the atom rendered the joining space AND an empty muted span (textContent
    // "Alone.    ").
    it("stands the run-in alone for a whitespace-only summary — no stray space or empty node", () => {
      render(<EntryTeaser title="Alone." summary="   " slug="x" level={3} />);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading.parentElement?.textContent).toBe("Alone.");
    });

    // Regression guard: a whitespace-only slug (hand-editable `slug.current`) must render plain
    // text, per "absent/empty → never a dead link". Without the slug's `.trim()` guard the atom
    // rendered <a href="/   ">. Same missing-trim shape as the summary guard above.
    it("renders plain text for a whitespace-only slug — never a dead link", () => {
      render(<EntryTeaser title="Slugless." slug="   " level={3} />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });
});
