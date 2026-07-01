import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Home is an async Server Component that fetches the featured entries. Mock the single read
// path so no network touches Vitest; `vi.hoisted` lets the fixture exist before the hoisted
// `vi.mock` factory runs. cardSwatches runs for real on the fixture's
// brandColor — it's pure/defensive, so no further mocking is needed.
const { FEATURED_FIXTURE } = vi.hoisted(() => ({
  FEATURED_FIXTURE: [
    {
      _id: "1",
      title: "OKLCH Engine",
      slug: "oklch-engine",
      kind: "project",
      stage: "prototype",
      blurb: "A high-chroma brand.",
      brandColor: "oklch(0.7 0.28 330)",
      fontKey: "fraunces",
    },
    {
      _id: "2",
      title: "First Light",
      slug: "first-light",
      kind: "project",
      stage: "prototype",
      blurb: "The first entry.",
      brandColor: "oklch(0.7 0.15 70)",
      fontKey: "newsreader",
    },
  ],
}));

vi.mock("@/sanity/lib/sanityFetch", () => ({
  sanityFetch: vi.fn(async () => FEATURED_FIXTURE),
}));

import Home from "./page";

describe("Home (featured front door)", () => {
  it("renders the site owner as the page heading", async () => {
    render(await Home());
    expect(
      screen.getByRole("heading", { level: 1, name: /jamie thompson/i }),
    ).toBeInTheDocument();
  });

  it("renders each featured entry as a card linking to its flat /[slug]", async () => {
    render(await Home());
    expect(
      screen.getByRole("heading", { name: /featured/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /oklch engine/i })).toHaveAttribute(
      "href",
      "/oklch-engine",
    );
    expect(screen.getByRole("link", { name: /first light/i })).toHaveAttribute(
      "href",
      "/first-light",
    );
  });

  it("links onward to the browsable Index", async () => {
    render(await Home());
    expect(
      screen.getByRole("link", { name: /browse everything/i }),
    ).toHaveAttribute("href", "/browse");
  });
});
