import { describe, expect, it } from "vitest";

import { buildTokenSet, contrastWCAG } from "@garden/oklch";

/**
 * The entry card's contrast contract, measured — not eyeballed (QA, independent of the slice).
 *
 * WHY THIS FILE EXISTS. Before the neutral-surface refactor the card's legibility was true BY
 * CONSTRUCTION: the plate was `--accent` and its ink `--accent-foreground`, an engine-SOLVED
 * contrast pair, and the focus ring reused that same solved ink. The refactor moved the card
 * onto `--surface` with `--foreground` / `--muted-foreground` ink and a `--ring` outline — four
 * relationships the engine does NOT solve for each other (`--foreground` and `--muted-foreground`
 * are solved against `--background`, not against `--surface`; `--ring` is derived independently).
 *
 * The margins happen to be comfortable today. That is a FACT ABOUT THE CURRENT BAKE, not a
 * guarantee — so pin it across a seed sweep, per scheme. Floors are WCAG 2.2 AA:
 * 1.4.3 Contrast (Minimum) 4.5:1 for text, 1.4.11 Non-text Contrast 3:1 for the focus
 * indicator and the card's boundary. https://www.w3.org/TR/WCAG22/
 */

const TEXT_FLOOR = 4.5;
const NON_TEXT_FLOOR = 3;

/** A spread of seeds: the site pink, cool/warm/green mid-chromas, and the achromatic extremes. */
const SEEDS = [
  "oklch(0.7 0.28 330)",
  "#3b82f6",
  "#facc15",
  "oklch(0.6 0.2 140)",
  "#ef4444",
  "#14b8a6",
  "oklch(0.5 0.3 300)",
  "#000000",
  "#ffffff",
] as const;

const SCHEMES = ["light", "dark"] as const;

/**
 * The card's measured relationships, as `[label, ink token, background token, floor]`.
 * Each names a real declaration in `EntryCard.module.css` / `EntryCard.tsx`.
 */
const PAIRS = [
  // `.card { background: var(--surface) }` + `<Heading level={3}>` inheriting `--foreground`.
  ["card title ink on the plate", "foreground", "surface", TEXT_FLOOR],
  // `<Text color="muted-foreground">` summary and the `EntryMeta` readout, on the same plate.
  [
    "card summary/meta ink on the plate",
    "muted-foreground",
    "surface",
    TEXT_FLOOR,
  ],
  // `.link:focus-visible { outline: … var(--ring) }`, inset so it sits ON the plate — so the
  // adjacent color it must clear is `--surface`, not the page `--background`.
  ["focus ring against the plate", "ring", "surface", NON_TEXT_FLOOR],
  // `.card { border: … solid var(--border) }` — the card's only separation from the page, since
  // `--surface` and `--background` are near-identical (measured below).
  ["card hairline against the page", "border", "background", NON_TEXT_FLOOR],
  // `--card-mark: var(--border)` painted by `.card::before` onto the plate.
  ["head mark against the plate", "border", "surface", NON_TEXT_FLOOR],
] as const;

describe("EntryCard — measured contrast of the neutral surface", () => {
  for (const [label, ink, bg, floor] of PAIRS) {
    it(`${label}: clears ${floor}:1 for every seed, both schemes`, () => {
      const failures: string[] = [];
      for (const seed of SEEDS) {
        const { tokens } = buildTokenSet(seed);
        for (const scheme of SCHEMES) {
          const ratio = contrastWCAG(tokens[ink][scheme], tokens[bg][scheme]);
          if (ratio < floor) {
            failures.push(
              `${seed} (${scheme}): --${ink} on --${bg} = ${ratio.toFixed(2)}:1 < ${floor}:1`,
            );
          }
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it("the plate is a QUIET lift off the page — the hairline, not the fill, is the boundary", () => {
    // `--surface` sits within a hair of `--background` at every seed (measured ~1.06–1.09:1), so
    // the card is NOT distinguishable by its fill. That is exactly why `border` and the
    // `::before` mark carry the 3:1 obligation above: remove the hairline and the card's edge
    // disappears for a low-vision reader. Pinned so a future "make the plate pop" tweak that
    // silently makes the border redundant is a deliberate, visible change.
    for (const seed of SEEDS) {
      const { tokens } = buildTokenSet(seed);
      for (const scheme of SCHEMES) {
        const ratio = contrastWCAG(
          tokens.surface[scheme],
          tokens.background[scheme],
        );
        expect(ratio).toBeLessThan(NON_TEXT_FLOOR);
      }
    }
  });
});
