import { buildTokenSet, tokenSetToDeclarations } from "@garden/oklch";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EngineBoardExperience from "./experience";

// The board's ONE job is to render exactly the tokens `@garden/oklch` bakes. Its token
// list is hardcoded in `experience.tsx`; the committed tests re-hardcode the SAME list,
// so they'd stay green even if BOTH the board and this list drifted from the engine. The
// guards below derive the expected set from the ENGINE at runtime (`buildTokenSet` →
// `tokenSetToDeclarations`) so a token added/removed/renamed in `BrandTokenName` breaks
// this test unless the board follows. `--<name>` lines only (skip `color-scheme:`).
function engineEmittedTokenNames(brandColor: string): Set<string> {
  const decls = tokenSetToDeclarations(buildTokenSet(brandColor));
  const names = new Set<string>();
  for (const line of decls.split("\n")) {
    const match = line.match(/^(--[a-z0-9-]+):/);
    if (match) names.add(match[1]);
  }
  return names;
}

function boardRenderedTokenNames(container: HTMLElement): Set<string> {
  return new Set(
    Array.from(container.querySelectorAll("code")).map(
      (el) => el.textContent ?? "",
    ),
  );
}

// The engine-board is a pure, sync, presentational Server Component reading only scoped CSS
// vars — so jsdom renders it directly (no async RSC, no font/Sanity deps). These tests pin
// the CONTRACT the board exists to prove: every emitted semantic + status token gets a chip
// keyed off `var(--<token>)`, so the board tracks the engine's output rather than an invented
// subset.

const SEMANTIC_TOKENS = [
  "bg",
  "surface",
  "surface-2",
  "border",
  "text",
  "text-muted",
  "accent",
  "accent-text",
  "on-accent",
  "focus-ring",
];
const STATUS_TOKENS = ["success", "error", "warning", "info"];

describe("EngineBoardExperience", () => {
  it("renders a labelled chip for every semantic and status token", () => {
    render(<EngineBoardExperience />);
    for (const token of [...SEMANTIC_TOKENS, ...STATUS_TOKENS]) {
      expect(screen.getByText(`--${token}`)).toBeInTheDocument();
    }
  });

  it("fills each chip from its live scoped `var(--<token>)`", () => {
    const { container } = render(<EngineBoardExperience />);
    // The accent chip's inline background reads the scoped accent token, not a hardcoded
    // color — this is what makes the board re-theme per brand scope.
    const accentLabel = screen.getByText("--accent");
    const swatch = accentLabel.closest("li");
    expect(swatch).not.toBeNull();
    const chip = (swatch as HTMLElement).querySelector("span");
    expect(chip).toHaveStyle({ background: "var(--accent)" });
    // Every token in the board is chip-backed — no fewer chips than declared tokens.
    const chips = container.querySelectorAll("li > span");
    expect(chips).toHaveLength(SEMANTIC_TOKENS.length + STATUS_TOKENS.length);
  });

  it("groups tokens under Semantic roles and Status signals headings", () => {
    render(<EngineBoardExperience />);
    expect(
      screen.getByRole("heading", { name: /semantic roles/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /status signals/i }),
    ).toBeInTheDocument();
  });

  // --- Adversarial QA additions (fresh, no-prior-context) ---

  // The load-bearing guard the committed suite lacks: the board must render EXACTLY the
  // engine's emitted token contract — no fewer (a token the engine bakes but the board
  // hides) and no more (a name the board invents that the engine never emits). Derived
  // from the live engine so it catches drift the hardcoded lists structurally cannot.
  it("renders exactly the engine's emitted token set — no drift, no extras", () => {
    const emitted = engineEmittedTokenNames("#3b82f6");
    const { container } = render(<EngineBoardExperience />);
    const rendered = boardRenderedTokenNames(container);

    const missingFromBoard = [...emitted].filter((t) => !rendered.has(t));
    const extraOnBoard = [...rendered].filter((t) => !emitted.has(t));

    expect(
      missingFromBoard,
      `engine bakes these but the board never renders them: ${missingFromBoard.join(", ")}`,
    ).toEqual([]);
    expect(
      extraOnBoard,
      `board renders these but the engine never emits them: ${extraOnBoard.join(", ")}`,
    ).toEqual([]);
    expect(rendered).toEqual(emitted);
  });

  // Token NAMES are structural (`BrandTokenName`), independent of the seed color. Proving
  // brand-invariance makes the guard above color-agnostic — the set can't be an accident
  // of one seed.
  it("emits a brand-invariant token-name set", () => {
    expect(engineEmittedTokenNames("#3b82f6")).toEqual(
      engineEmittedTokenNames("oklch(0.7 0.15 30)"),
    );
  });

  // Each chip's inline fill must key off ITS OWN label token — a copy/paste bug where a
  // chip points at a different token than its `--label` would still render N chips and
  // pass a count check, but is a real defect the board exists to prove against.
  it("fills every chip from the var() of its own adjacent label", () => {
    const { container } = render(<EngineBoardExperience />);
    const items = Array.from(container.querySelectorAll("li"));
    expect(items.length).toBeGreaterThan(0);
    for (const li of items) {
      const label = li.querySelector("code")?.textContent ?? "";
      const chip = li.querySelector("span");
      expect(chip).not.toBeNull();
      expect(chip).toHaveStyle({ background: `var(${label})` });
      // The colour swatch carries no accessible name — the label is the sole text
      // conveyor, so the chip must be hidden from AT (color is decorative here).
      expect(chip).toHaveAttribute("aria-hidden", "true");
    }
  });

  // The board is a named landmark region so AT users can find/skip it; its name comes
  // from the visible <h2> via aria-labelledby, not a duplicated aria-label.
  it("exposes the board as a named region landmark", () => {
    render(<EngineBoardExperience />);
    expect(
      screen.getByRole("region", { name: /engine output/i }),
    ).toBeInTheDocument();
  });

  // The two swatch groups are real lists (semantics AT relies on for "N items"), not
  // bare divs, and there are exactly two of them.
  it("renders the swatches as two accessible lists", () => {
    render(<EngineBoardExperience />);
    expect(screen.getAllByRole("list")).toHaveLength(2);
  });
});
