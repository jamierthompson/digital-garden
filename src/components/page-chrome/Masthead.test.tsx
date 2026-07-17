import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import clusterStyles from "@/components/layout/Cluster.module.css";
import gridStyles from "@/components/layout/ContentGrid.module.css";

import Masthead from "./Masthead";

describe("Masthead", () => {
  it("renders the byline as a paragraph, never a heading (pages own their h1)", () => {
    render(<Masthead />);
    const byline = screen.getByText(
      /the design-engineering garden of jamie thompson/i,
    );
    expect(byline.tagName).toBe("P");
    expect(
      screen.queryByRole("heading", { name: /design-engineering garden/i }),
    ).toBeNull();
  });

  it("keeps the decorative dateline hidden from assistive tech", () => {
    render(<Masthead />);
    expect(screen.getByText(/est\. 2026/i)).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("composes the band from ContentGrid (alignment) + a Cluster inner row (wrap)", () => {
    render(<Masthead />);
    // The band root is the shared content grid; the inner row is a Cluster (intrinsic flex +
    // wrap reflow, no @media) sitting in a lane of it.
    const inner = screen.getByText(/est\. 2026/i).parentElement;
    expect(inner).toHaveClass(clusterStyles.cluster);
    expect(inner?.parentElement).toHaveClass(gridStyles.grid);
  });

  it("keeps the byline↔dateline gap at the space-4 step through the Cluster conduit", () => {
    render(<Masthead />);
    // Dropping the gap prop wouldn't fail any class assertion — the row would silently fall
    // back to the tighter --space-cluster default. Pin the conduit value.
    const inner = screen.getByText(/est\. 2026/i).parentElement;
    expect(inner?.style.getPropertyValue("--cluster-gap")).toBe(
      "var(--space-4)",
    );
  });

  it("wears the muted ink on both the byline and the dateline via the color prop", () => {
    render(<Masthead />);
    // The ink moved from module rules (.byline/.dateline) to the Text color prop — dropping
    // the prop would silently promote the chrome copy to full-ink foreground.
    const byline = screen.getByText(
      /the design-engineering garden of jamie thompson/i,
    );
    expect(byline).toHaveAttribute("data-color", "muted-foreground");
    expect(screen.getByText(/est\. 2026/i)).toHaveAttribute(
      "data-color",
      "muted-foreground",
    );
  });
});

/**
 * The masthead reflows intrinsically: the byline/dateline row wraps (via Cluster), so the
 * dateline drops to its own line when the row is tight — never via a `@media` query in this
 * module (a `@media (--token)` custom-media query has no PostCSS substitution in this config,
 * so it would ship verbatim and silently never match).
 */
describe("Masthead.module.css — no media queries", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/page-chrome/Masthead.module.css"),
    "utf8",
  );

  it("uses no @media and no @custom-media", () => {
    expect(css).not.toMatch(/@media/);
    expect(css).not.toMatch(/@custom-media/);
    expect(css).not.toContain("--xs-down");
  });

  it("places the inner row in the wide lane of the band grid", () => {
    // jsdom can't lay out the grid; pin the lane at the source. Without this the row falls to
    // the default prose lane and the byline misaligns with the wordmark below it.
    expect(css).toMatch(/\.inner\s*\{[^}]*grid-column:\s*wide/);
  });
});
