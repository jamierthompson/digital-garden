import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryNotFound from "./not-found";

// The global `SkipLink` (mounted in layout.tsx, rendered on EVERY view incl. this 404) targets
// `#main-content`. The accessibility contract (accessibility-and-performance.md, Focus &
// interaction; WCAG 2.4.1)
// is "one `<main id="main-content">` per route" so a keyboard user can always bypass the shell
// nav. This state frame renders its own `<main>` OUTSIDE the `Page` primitive, so it must still
// carry the skip target — otherwise the skip-link is a dead anchor on the not-found view.
describe("EntryNotFound — skip-link target", () => {
  it("renders a single <main> landmark", () => {
    render(<EntryNotFound />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("carries id='main-content' so the global skip-link's target exists on the 404 view", () => {
    render(<EntryNotFound />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("carries tabIndex=-1 so the skip-link can move focus (delegated to Page, pinned here)", () => {
    render(<EntryNotFound />);
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });

  it("offers the way out: a real link back to home", () => {
    render(<EntryNotFound />);
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
