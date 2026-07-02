import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// NowPage is an async Server Component reading the `now` stream. Mock the single read path;
// `vi.hoisted` lets the fixture exist before the hoisted `vi.mock` factory runs.
const { NOW_FIXTURE } = vi.hoisted(() => ({
  NOW_FIXTURE: [
    {
      _id: "1",
      title: "Flattening the routes",
      slug: "now-jul-2026",
      iterated: "2026-07-01",
      blurb: "IA rework.",
    },
    {
      _id: "2",
      title: "Proving the engine",
      slug: "now-jun-2026",
      iterated: "2026-06-15",
      blurb: "Seeding brands.",
    },
  ],
}));

vi.mock("@/sanity/lib/sanityFetch", () => ({
  sanityFetch: vi.fn(async () => NOW_FIXTURE),
}));

import NowPage from "./page";

describe("Now page (Sanity-driven stream)", () => {
  it("renders each now-update linking to its flat /[slug]", async () => {
    render(await NowPage());
    expect(
      screen.getByRole("link", { name: /flattening the routes/i }),
    ).toHaveAttribute("href", "/now-jul-2026");
    expect(
      screen.getByRole("link", { name: /proving the engine/i }),
    ).toHaveAttribute("href", "/now-jun-2026");
  });

  it("stamps each update with its formatted UTC date", async () => {
    render(await NowPage());
    expect(screen.getByText("July 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("June 15, 2026")).toBeInTheDocument();
  });

  it("keeps the nownownow.com footnote link", async () => {
    render(await NowPage());
    expect(screen.getByRole("link", { name: /now page/i })).toHaveAttribute(
      "href",
      "https://nownownow.com/about",
    );
  });
});
