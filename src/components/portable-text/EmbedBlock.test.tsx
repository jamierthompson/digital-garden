// QA #131 — EmbedBlock is the seam where an authored `liveEmbed` meets code. The
// contract under test: (1) a missing/unknown key degrades to the visible MissingEmbed —
// never a throw; (2) with a project `scope` the embed mounts inside its OWN
// `[data-project]` container; (3) without a scope it mounts bare; (4) the caption stays
// OUTSIDE the brand scope (editorial register). EmbedBlock is an async Server Component,
// so each case awaits the element before rendering (the jsdom-compatible RSC pattern).

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next/font/google is untransformed under Vitest (see roster.test.ts) — mock the faces
// the roster imports, loaded transitively via EmbedBlock → ProjectScope → resolveScope.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import EmbedBlock from "./EmbedBlock";

const SCOPE = {
  slug: "palette-studio",
  brandColor: "oklch(0.66 0.2 350)",
  fontKey: "jetbrains-mono",
};

describe("EmbedBlock", () => {
  it("renders the visible placeholder when the block carries no embedKey", async () => {
    render(await EmbedBlock({}));
    expect(screen.getByRole("note")).toHaveTextContent("Embed unavailable");
    expect(screen.getByRole("note")).toHaveTextContent("(none)");
  });

  it("renders the placeholder (echoing the key) for an unknown embedKey", async () => {
    render(await EmbedBlock({ embedKey: "retired-widget" }));
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Embed unavailable");
    expect(note).toHaveTextContent("retired-widget");
  });

  // QA-131 D1 (fixed): a prototype-inherited embedKey ("__proto__", "constructor", …)
  // must resolve to NotFound → the visible placeholder, never a Found non-loader whose
  // `.value()` throw would escape the figure and blank the entry via the route error
  // boundary. Guarded with Object.hasOwn in src/lib/resolvers/embeds.ts (same pattern
  // in components.ts).
  it("never throws on a hostile embedKey (prototype-inherited name)", async () => {
    render(await EmbedBlock({ embedKey: "__proto__" }));
    expect(screen.getByRole("note")).toHaveTextContent("Embed unavailable");
  });

  it("mounts a resolved embed inside its OWN [data-project] scope when given one", async () => {
    const { container } = render(
      await EmbedBlock({ embedKey: "palette-studio-seed", scope: SCOPE }),
    );
    const scoped = container.querySelector('[data-project="palette-studio"]');
    expect(scoped).not.toBeNull();
    // The embed (a studio slot with no provider above it) renders ITS placeholder inside
    // the scope — proving both the per-slot scoping and the provider-less degradation
    // through the real resolver pipeline.
    expect(scoped?.textContent).toMatch(/no studio frame mounted/);
  });

  it("mounts a resolved embed bare (no scope container) when no scope is given", async () => {
    const { container } = render(
      await EmbedBlock({ embedKey: "palette-studio-seed" }),
    );
    expect(container.querySelector("[data-project]")).toBeNull();
    // Still renders the slot (which degrades to its placeholder without a provider).
    expect(screen.getByText(/no studio frame mounted/)).toBeInTheDocument();
  });

  it("renders the caption OUTSIDE the brand scope, in the editorial figure", async () => {
    const { container } = render(
      await EmbedBlock({
        embedKey: "palette-studio-seed",
        caption: "A caption in the essay voice",
        scope: SCOPE,
      }),
    );
    const caption = screen.getByText("A caption in the essay voice");
    expect(caption.tagName).toBe("FIGCAPTION");
    // The caption must NOT sit inside the scoped container — brand never reaches prose.
    expect(caption.closest("[data-project]")).toBeNull();
    // And the whole block is one <figure>.
    expect(container.querySelector("figure")).toContainElement(caption);
  });

  it("renders no figcaption at all when the caption is absent", async () => {
    const { container } = render(
      await EmbedBlock({ embedKey: "palette-studio-seed", scope: SCOPE }),
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });
});
