// QA #131 — SlotBlock is the seam where an authored `slot` meets code. The
// contract under test: (1) a missing/unknown key degrades to the visible MissingSlot —
// never a throw; (2) with an entry `scope` the slot mounts inside its OWN
// `[data-entry]` container; (3) without a scope it mounts bare; (4) the caption stays
// OUTSIDE the theme scope (editorial register). SlotBlock is an async Server Component,
// so each case awaits the element before rendering (the jsdom-compatible RSC pattern).

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next/font/google is untransformed under Vitest (see roster.test.ts) — mock the faces
// the roster imports, loaded transitively via SlotBlock → EntryScope → resolveScope.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

// No slots are registered in the app today, so the resolved-slot path is exercised through a
// mocked resolver: "test-slot" resolves to a marker component, everything else is NotFound (the
// real resolution helpers, so `isNotFound` in SlotBlock still narrows correctly).
vi.mock("@/lib/resolvers/slots", async () => {
  const { found, notFound } = await vi.importActual<
    typeof import("@/lib/resolvers/resolution")
  >("@/lib/resolvers/resolution");
  return {
    resolveSlotKey: (key: string) =>
      key === "test-slot"
        ? found(() =>
            Promise.resolve({
              default: () => <div>resolved slot content</div>,
            }),
          )
        : notFound("slot", key),
  };
});

import SlotBlock from "./SlotBlock";

const SCOPE = {
  slug: "demo-x",
  bodyFont: "space-grotesk",
};

describe("SlotBlock", () => {
  it("renders the visible placeholder when the block carries no slotKey", async () => {
    render(await SlotBlock({}));
    expect(screen.getByRole("note")).toHaveTextContent("Slot unavailable");
    expect(screen.getByRole("note")).toHaveTextContent("(none)");
  });

  it("renders the placeholder when the slotKey is an empty string (falsy, not just absent)", async () => {
    // Sanity stores slotKey as free text; an emptied-then-saved field can round-trip as
    // "". The falsy guard must catch it — never hand "" to the resolver as a real key.
    render(await SlotBlock({ slotKey: "" }));
    expect(screen.getByRole("note")).toHaveTextContent("Slot unavailable");
    expect(screen.getByRole("note")).toHaveTextContent("(none)");
  });

  it("renders the placeholder (echoing the key) for an unknown slotKey", async () => {
    render(await SlotBlock({ slotKey: "retired-widget" }));
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Slot unavailable");
    expect(note).toHaveTextContent("retired-widget");
  });

  // QA-131 D1 (fixed): a prototype-inherited slotKey ("__proto__", "constructor", …)
  // must resolve to NotFound → the visible placeholder, never a Found non-loader whose
  // `.value()` throw would escape the figure and blank the entry via the route error
  // boundary. Guarded with Object.hasOwn in src/lib/resolvers/slots.ts (same pattern
  // in components.ts).
  it("never throws on a hostile slotKey (prototype-inherited name)", async () => {
    render(await SlotBlock({ slotKey: "__proto__" }));
    expect(screen.getByRole("note")).toHaveTextContent("Slot unavailable");
  });

  it("mounts a resolved slot inside its OWN [data-entry] scope when given one", async () => {
    const { container } = render(
      await SlotBlock({ slotKey: "test-slot", scope: SCOPE }),
    );
    const scoped = container.querySelector('[data-entry="demo-x"]');
    expect(scoped).not.toBeNull();
    // The resolved slot renders inside the scope — proving the per-slot scoping through the
    // resolver → await → mount pipeline.
    expect(scoped?.textContent).toMatch(/resolved slot content/i);
  });

  it("stamps the wide lane by default and honors an authored full/prose lane", async () => {
    for (const [authored, expected] of [
      [undefined, "wide"],
      ["full", "full"],
      ["prose", "prose"],
      ["sidebar;}hostile", "wide"],
    ] as const) {
      const { container, unmount } = render(
        await SlotBlock({ slotKey: "test-slot", lane: authored }),
      );
      expect(
        container.querySelector("figure"),
        `lane ${String(authored)}`,
      ).toHaveAttribute("data-lane", expected);
      unmount();
    }
  });

  it("mounts a resolved slot bare (no scope container) when no scope is given", async () => {
    const { container } = render(await SlotBlock({ slotKey: "test-slot" }));
    expect(container.querySelector("[data-entry]")).toBeNull();
    // Still renders the resolved slot.
    expect(screen.getByText(/resolved slot content/i)).toBeInTheDocument();
  });

  it("renders the caption OUTSIDE the theme scope, in the editorial figure", async () => {
    const { container } = render(
      await SlotBlock({
        slotKey: "test-slot",
        caption: "A caption in the essay voice",
        scope: SCOPE,
      }),
    );
    const caption = screen.getByText("A caption in the essay voice");
    expect(caption.tagName).toBe("FIGCAPTION");
    // The caption must NOT sit inside the scoped container — the theme never reaches prose.
    expect(caption.closest("[data-entry]")).toBeNull();
    // And the whole block is one <figure>.
    expect(container.querySelector("figure")).toContainElement(caption);
  });

  it("renders no figcaption at all when the caption is absent", async () => {
    const { container } = render(
      await SlotBlock({ slotKey: "test-slot", scope: SCOPE }),
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });

  // An emptied-then-saved caption round-trips as "" (falsy), not undefined.
  it("renders no figcaption for an empty-string caption", async () => {
    const { container } = render(
      await SlotBlock({
        slotKey: "test-slot",
        caption: "",
        scope: SCOPE,
      }),
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("wears the caption role on the figcaption itself (asChild Slot merge intact)", async () => {
    render(
      await SlotBlock({
        slotKey: "test-slot",
        caption: "A caption in the essay voice",
        scope: SCOPE,
      }),
    );
    const caption = screen.getByText("A caption in the essay voice");
    expect(caption.tagName).toBe("FIGCAPTION");
    expect(caption).toHaveAttribute("data-variant", "caption");
  });
});
