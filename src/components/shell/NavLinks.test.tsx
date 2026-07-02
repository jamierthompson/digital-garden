import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// NavLinks reads `usePathname`. Under Vitest there is no App Router context, so mock the
// hook with a mutable holder we can rewrite per test to exercise the active-state matcher.
const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));

import NavLinks from "./NavLinks";

afterEach(() => {
  pathnameMock.mockReset();
});

function activeLinkName(): string | null {
  const active = screen.queryByRole("link", { current: "page" });
  return active ? (active.textContent ?? "") : null;
}

describe("NavLinks — the journal masthead current-page indicator", () => {
  it("renders every IA destination as a link with its journal-lowercase label", () => {
    pathnameMock.mockReturnValue("/");
    render(<NavLinks />);
    const labels = screen.getAllByRole("link").map((a) => a.textContent);
    expect(labels).toEqual(["featured", "index", "now", "about", "system"]);
  });

  it("labels the Index 'index' but points it at /browse (route-name collision guard)", () => {
    pathnameMock.mockReturnValue("/");
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "index" })).toHaveAttribute(
      "href",
      "/browse",
    );
  });

  it("on home, only `featured` (/) is current — no section false-positive", () => {
    pathnameMock.mockReturnValue("/");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("featured");
    // Exactly one current item.
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("on /browse, `index` is current and `featured` (home) is NOT", () => {
    pathnameMock.mockReturnValue("/browse");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("index");
    expect(screen.getByRole("link", { name: "featured" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("lights a section for its descendant route (/system/tokens → system)", () => {
    pathnameMock.mockReturnValue("/system/tokens");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("system");
  });

  it("does NOT light `index` for a sibling prefix collision (/browse-archive)", () => {
    pathnameMock.mockReturnValue("/browse-archive");
    render(<NavLinks />);
    // No prefix false-positive: /browse-archive is not /browse nor /browse/*.
    expect(screen.getByRole("link", { name: "index" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(activeLinkName()).toBeNull();
  });

  it("does NOT light `system` for a lexical-prefix sibling (/systematic)", () => {
    pathnameMock.mockReturnValue("/systematic");
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "system" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("matches a section with a trailing slash (/now/ → now)", () => {
    pathnameMock.mockReturnValue("/now/");
    render(<NavLinks />);
    expect(activeLinkName()).toBe("now");
  });

  it("does not crash and marks nothing current when usePathname returns null", () => {
    pathnameMock.mockReturnValue(null);
    expect(() => render(<NavLinks />)).not.toThrow();
    expect(activeLinkName()).toBeNull();
  });
});
