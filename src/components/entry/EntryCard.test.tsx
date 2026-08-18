import { render, screen } from "@testing-library/react";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

import { buildTokenSet, contrastWCAG } from "@garden/oklch";

import { FEATURED_QUERY } from "@/sanity/lib/queries";

import {
  readModuleCss,
  referencedCustomProperties,
  ruleDeclarations,
} from "../../../tests/cssModule";

import EntryCard, { type EntryCardEntry } from "./EntryCard";

function entry(over: Partial<EntryCardEntry> = {}): EntryCardEntry {
  return {
    title: "A card",
    slug: "a-card",
    summary: "A short summary.",
    kind: "demo",
    stage: "budding",
    tended: null,
    linkCount: null,
    ...over,
  };
}

// EntryCard renders an <li>; mount inside a <ul> so the list-item semantics are valid.
function renderCard(data: EntryCardEntry) {
  return render(
    <ul>
      <EntryCard entry={data} />
    </ul>,
  );
}

describe("EntryCard", () => {
  it("links the title to the entry's flat /[slug] and shows the summary", () => {
    renderCard(entry());
    const link = screen.getByRole("link", { name: /a card/i });
    expect(link).toHaveAttribute("href", "/a-card");
    expect(screen.getByText("A short summary.")).toBeInTheDocument();
  });

  it("renders a slugless entry as a non-link heading, never a dead link", () => {
    const { container } = renderCard(entry({ title: "No route", slug: null }));
    expect(screen.queryByRole("link", { name: /no route/i })).toBeNull();
    expect(container.querySelector("a[href]")).toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: /no route/i }),
    ).toBeInTheDocument();
  });

  it("falls back to a neutral label for an untitled entry", () => {
    renderCard(entry({ title: null, slug: "x" }));
    expect(
      screen.getByRole("link", { name: /untitled entry/i }),
    ).toBeInTheDocument();
  });

  it("omits the summary paragraph when there is none", () => {
    renderCard(entry({ summary: null }));
    expect(screen.queryByText("A short summary.")).toBeNull();
  });

  it("omits the summary for an empty string, not just null — no stray empty node in the card", () => {
    // A blank Studio field serialises to "" (a valid string); the card's guard must treat it as
    // missing rather than render an empty paragraph that still takes the card's stack gap.
    const { container } = renderCard(entry({ summary: "" }));
    expect(screen.queryByText("A short summary.")).toBeNull();
    // With no summary the meta readout is the card's only <p>.
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renders the full meta readout: kind · stage · tended · related", () => {
    renderCard(
      entry({
        kind: "demo",
        stage: "evergreen",
        tended: "2026-07-16",
        linkCount: 2,
      }),
    );
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByText("Evergreen")).toBeInTheDocument();
    const time = screen.getByText("Last tended July 16, 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-07-16");
    expect(screen.getByText("2 Related")).toBeInTheDocument();
  });

  it("shows only what it has when part of the meta is missing", () => {
    renderCard(entry({ kind: null, stage: "seedling" }));
    expect(screen.getByText("Seedling")).toBeInTheDocument();
  });

  it("omits the meta row entirely when no fact is present", () => {
    const { container } = renderCard(entry({ kind: null, stage: null }));
    // Title still renders; nothing left to read out.
    expect(
      screen.getByRole("heading", { level: 3, name: /a card/i }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain("·");
    expect(container.querySelector('[data-variant="meta"]')).toBeNull();
  });

  it("carries no inline theme anywhere in the subtree (one seed paints a page)", () => {
    // Not just the <li>: a re-bind could reappear on the link or the heading, so sweep the
    // whole subtree for style attributes.
    const { container } = renderCard(entry({ linkCount: 4 }));
    expect(screen.getByRole("listitem").getAttribute("style")).toBeNull();
    const styled = [...container.querySelectorAll("[style]")];
    expect(styled.map((el) => el.outerHTML)).toEqual([]);
  });

  it("wears the foreground ink role on the title", () => {
    // The card declares no ink of its own in CSS (pinned below); the title's --foreground role
    // is set explicitly on the composed Heading primitive.
    renderCard(entry());
    expect(screen.getByRole("heading", { level: 3 })).toHaveAttribute(
      "data-color",
      "foreground",
    );
  });

  it("wears muted ink on the summary and the meta readout", () => {
    const { container } = renderCard(entry());
    expect(screen.getByText("A short summary.")).toHaveAttribute(
      "data-color",
      "muted-foreground",
    );
    expect(container.querySelector('[data-variant="meta"]')).toHaveAttribute(
      "data-color",
      "muted-foreground",
    );
  });
});

describe("EntryCard — the query is the card's real input", () => {
  it("FEATURED_QUERY projects every field EntryCardEntry requires", () => {
    // A card field that the query does NOT project arrives as `undefined` at runtime even
    // though the TS type says `T | null` — the failure the type system cannot see, because
    // the generated result type is what TS checks and hand-written fixtures always supply
    // the field. Assert against the QUERY TEXT.
    const projected = FEATURED_QUERY as unknown as string;
    for (const field of [
      "_id",
      "title",
      "slug",
      "kind",
      "stage",
      "tended",
      "summary",
      "linkCount",
    ]) {
      expect(projected).toContain(field);
    }
  });

  it("no longer projects the retired themeSeed (one seed paints a page)", () => {
    expect(FEATURED_QUERY as unknown as string).not.toContain("themeSeed");
  });

  it("renders from a row whose optional fields are ABSENT, not null", () => {
    // GROQ omits nothing here, but a draft/partial document can still yield undefined for an
    // unauthored field. The card must degrade, never crash.
    const sparse = { title: "Sparse", slug: "sparse" };
    expect(() => renderCard(sparse as unknown as EntryCardEntry)).not.toThrow();
    expect(screen.getByRole("link", { name: /sparse/i })).toBeInTheDocument();
  });
});

describe("EntryCard — title/slug boundaries", () => {
  // `title` is required() in the Studio, so the shape that actually reaches a card is a DRAFT
  // with no title yet — null, or "" from a cleared field. `||` covers both; these pin that.
  it("falls back to a neutral label for an empty-string title (not an empty heading)", () => {
    renderCard(entry({ title: "" }));
    expect(screen.getByRole("heading", { level: 3 })).toHaveAccessibleName(
      /untitled entry/i,
    );
  });

  // An empty-string slug is falsy, so it must degrade to the non-link card — never href="/".
  // Pinned because a switch to `slug != null` would silently ship links to the site root.
  it("renders an empty-string slug as a non-link card, never href='/'", () => {
    renderCard(entry({ slug: "" }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: /a card/i }),
    ).toBeInTheDocument();
  });
});

/**
 * The invisible-character shape Draft Mode actually delivers. `@sanity/client`'s stega encoder
 * appends a payload built from U+200B / U+200C / U+200D / U+FEFF to every prose string it maps
 * (`stegaEncodeSourceMap.js` → `vercelStegaCombine`), and it applies NO minimum-length guard:
 * `""` comes back as a string of invisible characters, i.e. truthy. `title`/`summary` are not on
 * the repo's stega denylist (`src/sanity/lib/stega.ts`), so this is the shape a cleared field has
 * in Presentation / Visual Editing — the exact environment the fallback comments cite.
 */
const STEGA_ENCODED_EMPTY =
  "\u200B\u200B\u200B\u200B" + "\u200C\u200D\uFEFF\u200B";

/** Text a screen reader would actually announce — zero-width stega characters removed. */
function announced(value: string | null | undefined): string {
  return (value ?? "").replace(/[\u200B\u200C\u200D\uFEFF]/gu, "").trim();
}

describe("EntryCard — adversarial QA: the draft shapes the schema does NOT forbid", () => {
  // The guards were dropped on the argument that `title` is `required()` in the Studio. That
  // claim does not hold for the shapes below: Sanity's string presence validator is a bare
  // falsy check with no trim (`flag === "required" && !value`, sanity 6.4.0), so a
  // whitespace-only title PUBLISHES clean; `summary` carries no `required()` at all (just a
  // 300-char cap); and validation never gates DRAFTS, which this app renders whenever Draft
  // Mode is on (`sanityFetch` → `perspective: "drafts"`).
  it("falls back to a neutral label for a whitespace-only title — never a nameless h3", () => {
    renderCard(entry({ title: "   " }));
    expect(screen.getByRole("heading", { level: 3 })).toHaveAccessibleName(
      /untitled entry/i,
    );
  });

  it("omits the summary for a whitespace-only summary — no empty paragraph in the stack", () => {
    // A blank-but-spaced Studio field is indistinguishable from an absent one to a reader, but
    // it still renders a node that takes the card's gap. With no visible summary the meta
    // readout must remain the card's only <p>.
    const { container } = renderCard(entry({ summary: "   " }));
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renders a whitespace-only slug as a non-link card — never href='/   '", () => {
    // `slug.current` is hand-editable, and the CSS-safety regex only runs at publish validation,
    // never on a draft. A padded slug must degrade like an absent one, not ship a dead link.
    renderCard(entry({ slug: "   " }));
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("names the card when a cleared title arrives stega-encoded from Draft Mode", () => {
    renderCard(entry({ title: STEGA_ENCODED_EMPTY }));
    expect(
      announced(screen.getByRole("heading", { level: 3 }).textContent),
    ).not.toBe("");
  });
});

describe("EntryCard — adversarial QA: the markup each surface now owns itself", () => {
  // Coverage the deleted `EntryTeaser` suite used to carry for every surface at once. Now that
  // each surface renders the pairing itself, each surface needs its own pin.
  it("stacks the title over its summary as two separate blocks, in that order", () => {
    renderCard(entry());
    const link = screen.getByRole("link", { name: /a card/i });
    const blocks = [...link.children];
    expect(blocks[0].tagName).toBe("H3");
    expect(blocks[0].textContent).toBe("A card");
    expect(blocks[1].tagName).toBe("P");
    expect(blocks[1].textContent).toBe("A short summary.");
    expect(blocks[1]).toHaveAttribute("data-variant", "body");
  });

  it("keeps the title out of the summary's paragraph — no run-in fusion left behind", () => {
    renderCard(entry());
    expect(screen.getByText("A short summary.").textContent).toBe(
      "A short summary.",
    );
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "A card",
    );
  });
});

describe("EntryCard — meta boundaries", () => {
  it("omits the backlink hint for zero, negative and non-integer link counts", () => {
    for (const linkCount of [0, -3, 1.5, Number.NaN]) {
      const { unmount } = renderCard(entry({ linkCount }));
      // Both vocabularies: the hint now reads "N Related" — /linked$/i alone went vacuous
      // at the label rename, so a rendered "0 Related" would have slipped past it.
      expect(screen.queryByText(/(linked|related)$/i)).toBeNull();
      unmount();
    }
  });

  it("renders the hint for a positive count", () => {
    renderCard(entry({ linkCount: 2 }));
    expect(screen.getByText("2 Related")).toBeInTheDocument();
  });
});

/**
 * The neutral surface's CSS-source contract. Pinned at the source (jsdom loads no stylesheets
 * and computes no custom properties) via the repo's postcss helpers — a commented-out
 * declaration is NOT a live one, which a hand-rolled regex could not tell apart.
 */
const CARD_CSS = readModuleCss("src/components/entry/EntryCard.module.css");

describe("EntryCard — the neutral surface's CSS contract", () => {
  it("declares no ink ROLE in CSS — summary/meta ink is the type primitives' color prop", () => {
    // The card comment states "Ink is not declared here". Verified precisely: the module's one
    // `color` declaration is `.link { color: inherit }` — a UA link-blue reset, not a role. Any
    // `color: var(--<role>)` would be the module taking ink back from the primitives, which is
    // the drift this guards (CSS and prop both stating ink → the module wins at equal layer).
    const inks: string[] = [];
    postcss.parse(CARD_CSS).walkDecls("color", (decl) => {
      inks.push(decl.value);
    });
    expect(inks).toEqual(["inherit"]);
  });

  it("reads no accent token — the plate is --surface with a --border hairline", () => {
    const vars = referencedCustomProperties(CARD_CSS);
    expect([...vars].filter((v) => v.includes("accent"))).toEqual([]);
    expect(vars.has("--surface")).toBe(true);
    expect(vars.has("--border")).toBe(true);
  });

  it("draws the focus ring from the ring role, inset so overflow:hidden can't clip it", () => {
    const focus = ruleDeclarations(CARD_CSS, ".link:focus-visible");
    expect(focus.get("outline")).toContain("var(--ring)");
    // `.card` sets `overflow: hidden`; a non-negative offset would clip the indicator away
    // entirely, failing WCAG 2.2 SC 2.4.11 Focus Not Obscured.
    // https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum
    const offset = focus.get("outline-offset") ?? "";
    expect(parseFloat(offset)).toBeLessThan(0);
  });

  it("keeps the head mark a STRUCTURE token, never a text-tier ink", () => {
    // `--card-mark` paints a non-text graphic (WCAG 2.2 SC 1.4.11, solved at the `ui` tier).
    // Binding it to a `*-text` role would be the wrong tier — and `lint:icon` cannot see it,
    // because `.card` does not tokenize to a graphic word and the property is `background`.
    const card = ruleDeclarations(CARD_CSS, ".card");
    const mark = card.get("--card-mark") ?? "";
    expect(mark).toBe("var(--border)");
    expect(mark).not.toMatch(/-text\s*[,)]/);
  });
});

/**
 * The card's contrast contract, measured — not eyeballed.
 *
 * Before the neutral-surface refactor the card's legibility was true BY CONSTRUCTION: the
 * plate was `--accent` and its ink the engine-SOLVED `--accent-foreground` pair. The neutral
 * card reads `--surface` with `--foreground` / `--muted-foreground` ink and a `--ring`
 * outline — relationships the engine does NOT solve for each other (`--foreground` and
 * `--muted-foreground` are solved against `--background`, not `--surface`; `--ring` is derived
 * independently). The margins are comfortable today; that is a FACT ABOUT THE CURRENT BAKE,
 * not a guarantee — so pin it across a seed sweep, per scheme. Floors are WCAG 2.2 AA:
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
 * Each names a real declaration in `EntryCard.module.css` or the ink the composed
 * `Heading` / `Text` / `EntryMeta` primitives wear on the card.
 */
const PAIRS = [
  // `.card { background: var(--surface) }` + the card title wearing `--foreground`.
  ["card title ink on the plate", "foreground", "surface", TEXT_FLOOR],
  // The summary and the `EntryMeta` readout wearing `--muted-foreground`, on the same plate.
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
