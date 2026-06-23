import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProjectScope from "./ProjectScope";

// ProjectScope is a SYNC server component, so jsdom can render it (async RSCs cannot —
// see testing.md). React hoists the `<style precedence>` into <head>, so we assert the
// observable wrapper + children rather than the style node (its flush-before-paint
// behaviour is verified in the browser, recorded in phase-0.5-render-proofs.md).
describe("ProjectScope (stub)", () => {
  it("wraps children in the scoped [data-project] for a known slug", () => {
    render(
      <ProjectScope seed={{ slug: "oklch-engine" }}>
        <p>module content</p>
      </ProjectScope>,
    );
    const content = screen.getByText("module content");
    expect(content.closest("[data-project]")).toHaveAttribute(
      "data-project",
      "oklch-engine",
    );
  });

  it("degrades to the fallback scope for an unknown slug (never throws) [D9]", () => {
    expect(() =>
      render(
        <ProjectScope seed={{ slug: "nope" }}>
          <p>still rendered</p>
        </ProjectScope>,
      ),
    ).not.toThrow();
    expect(
      screen.getByText("still rendered").closest("[data-project]"),
    ).toHaveAttribute("data-project", "fallback");
  });
});
