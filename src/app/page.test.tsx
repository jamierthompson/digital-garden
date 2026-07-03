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
      title: "OKLCH Palette Studio",
      slug: "palette-studio",
      kind: "project",
      stage: "sketch",
      blurb: "A seed in, a solved palette out.",
      brandColor: "oklch(0.7 0.28 330)",
      fontKey: null,
    },
    {
      _id: "2",
      title: "Feature Lens",
      slug: "feature-lens",
      kind: "project",
      stage: "sketch",
      blurb: "Looking inside a model.",
      brandColor: "oklch(0.7 0.15 70)",
      fontKey: null,
    },
  ],
}));

vi.mock("@/sanity/lib/sanityFetch", () => ({
  sanityFetch: vi.fn(async () => FEATURED_FIXTURE),
}));

import Home from "./page";

describe("Home (featured front door)", () => {
  it("renders the garden's invitation headline as the h1 (not the byline)", async () => {
    render(await Home());
    expect(
      screen.getByRole("heading", { level: 1, name: /building in the open/i }),
    ).toBeInTheDocument();
  });

  it("renders each featured entry as a card linking to its flat /[slug]", async () => {
    render(await Home());
    expect(
      screen.getByRole("heading", { name: /featured/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /oklch palette studio/i }),
    ).toHaveAttribute("href", "/palette-studio");
    expect(screen.getByRole("link", { name: /feature lens/i })).toHaveAttribute(
      "href",
      "/feature-lens",
    );
  });
});
