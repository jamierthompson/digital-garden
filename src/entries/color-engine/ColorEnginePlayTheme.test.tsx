import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PageTheme from "@/components/theme/PageTheme";
import {
  resolveThemeDeclarations,
  tokenSetToThemeDeclarations,
  type ThemeDeclaration,
} from "@/lib/theme";

import ColorEngineProvider from "./ColorEngineProvider";
import SeedSlot from "./slots/SeedSlot";
import RulesSlot from "./slots/RulesSlot";
import ExportSlot from "./slots/ExportSlot";
import { derivePalette } from "./core/derive";
import { DEFAULT_RULES, DEFAULT_GAMUT } from "./core/rules";
import { DEFAULT_SEED } from "./core/presets";

// Adversarial QA for the ephemeral <html> play path (#178, #4): the Color Engine page mounts
// TWO ThemeReappliers on the ONE shared `<html>` binding — the authored `PageTheme` (page seed,
// the FIRST sibling in `[slug]/page.tsx`) and the live play re-applier the provider renders
// (nested inside the LATER sibling, `<main>`). React fires layout effects child-first, so the
// deeper play re-applier commits LAST and governs `<html>`. These tests pin that ordering and the
// ephemerality contracts (no-bleed onto authored routes, no persistence) the author's suite skips.

/** Read a token's value from an already-resolved declaration list. */
function tokenIn(decls: ThemeDeclaration[], name: string): string {
  const found = decls.find(([n]) => n === name);
  if (!found) throw new Error(`no --${name} in declarations`);
  return found[1];
}

/** What the AUTHORED path stamps for a seed (the `PageTheme`/`<html>` inline-script value). */
function authored(seed: unknown): ThemeDeclaration[] {
  return resolveThemeDeclarations(seed);
}

/** What the PLAY path stamps for a seed at the engine defaults. */
function played(seed: string): ThemeDeclaration[] {
  return tokenSetToThemeDeclarations(
    derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT).tokenSet,
  );
}

function htmlToken(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

/** The real page composition order: `PageTheme` first, the interactive canvas second. */
function renderCanvasRoute(pageSeed: unknown) {
  return render(
    <>
      <PageTheme seed={pageSeed} />
      <ColorEngineProvider slug="demo">
        <SeedSlot />
        <RulesSlot />
        <ExportSlot />
      </ColorEngineProvider>
    </>,
  );
}

afterEach(() => {
  // The play path writes directly to the real <html>; reset it so tests don't leak into each other.
  document.documentElement.removeAttribute("style");
});

describe("Color Engine · ephemeral <html> play theme (#178)", () => {
  it("the live play re-applier governs <html>, winning over the page's authored re-applier", () => {
    // Force the two seeds to DIFFER so the winner is observable. In production they're equal
    // (DEFAULT_SEED === the page's authored brandColor), so first paint is flash-free; here a
    // distinct page seed exposes WHICH re-applier lands last. If a refactor ever reordered the
    // page tree so `PageTheme` committed last, `<html>` would wear the authored seed and this
    // fails — exactly the regression to guard.
    const PAGE_SEED = "oklch(0.7 0.15 200)"; // a cyan, ≠ the flamingo DEFAULT_SEED
    renderCanvasRoute(PAGE_SEED);

    // The play default (DEFAULT_SEED) wins, NOT the authored page seed.
    expect(htmlToken("--accent")).toBe(
      tokenIn(played(DEFAULT_SEED), "--accent"),
    );
    expect(htmlToken("--accent")).not.toBe(
      tokenIn(authored(PAGE_SEED), "--accent"),
    );
  });

  it("moving a control re-stamps <html> to the played palette, page re-applier notwithstanding", () => {
    renderCanvasRoute(DEFAULT_SEED); // production case: page seed === play default
    const before = htmlToken("--accent");
    expect(before).toBe(tokenIn(played(DEFAULT_SEED), "--accent"));

    fireEvent.change(screen.getByLabelText("Seed color"), {
      target: { value: "#16a34a" },
    });

    expect(htmlToken("--accent")).toBe(tokenIn(played("#16a34a"), "--accent"));
    expect(htmlToken("--accent")).not.toBe(before);
  });

  it("does NOT bleed onto an authored route: navigating away restores the authored seed on every token", () => {
    // Play a wild seed on the Color Engine route…
    const { unmount } = renderCanvasRoute(DEFAULT_SEED);
    fireEvent.change(screen.getByLabelText("Seed color"), {
      target: { value: "#16a34a" },
    });
    const playedAccent = htmlToken("--accent");
    expect(playedAccent).toBe(tokenIn(played("#16a34a"), "--accent"));

    // …then soft-nav AWAY: the Color Engine tree unmounts and a plain authored page mounts.
    unmount();
    const OTHER_SEED = "oklch(0.7 0.15 200)";
    render(<PageTheme seed={OTHER_SEED} />);

    // Every semantic token the play stamped is overwritten by the authored route's re-applier —
    // no orphan carries the played value forward.
    for (const name of [
      "--accent",
      "--bg",
      "--surface",
      "--text",
      "--border",
    ]) {
      expect(htmlToken(name)).toBe(tokenIn(authored(OTHER_SEED), name));
    }
    expect(htmlToken("--accent")).not.toBe(playedAccent);
  });

  it("stamps the EXACT same token-name set as the authored path — so no played token can orphan-bleed", () => {
    // The no-bleed guarantee is structural: the play path can only overwrite tokens the authored
    // path also writes. Compare the name sets at the engine defaults AND under non-default rules
    // + gamut (the worst case for divergence).
    const authoredNames = new Set(authored(DEFAULT_SEED).map(([n]) => n));
    const playDefaultNames = new Set(played(DEFAULT_SEED).map(([n]) => n));
    const playRuled = tokenSetToThemeDeclarations(
      derivePalette(
        "#06b6d4",
        { ...DEFAULT_RULES, distribution: "punchy", tintedNeutrals: false },
        "srgb",
      ).tokenSet,
    );
    const playRuledNames = new Set(playRuled.map(([n]) => n));

    expect(playDefaultNames).toEqual(authoredNames);
    expect(playRuledNames).toEqual(authoredNames);
  });

  it("is byte-identical to the authored bake at the default seed — first paint never flashes", () => {
    // The provider's comment claims DEFAULT_RULES/DEFAULT_GAMUT reproduce the un-ruled engine
    // output bit-for-bit, so the post-hydration re-stamp equals what the inline script already
    // painted. Pin it: any drift here means a visible repaint on load.
    const a = new Map(authored(DEFAULT_SEED));
    for (const [name, value] of played(DEFAULT_SEED)) {
      expect(value, `token ${name} drifted from the authored bake`).toBe(
        a.get(name),
      );
    }
  });

  it("persists NOTHING: a play sequence writes no localStorage (hard reload resets)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    try {
      renderCanvasRoute(DEFAULT_SEED);
      fireEvent.change(screen.getByLabelText("Seed color"), {
        target: { value: "#16a34a" },
      });
      // Change a rule too — the whole play surface, not just the seed.
      fireEvent.click(screen.getByRole("radio", { name: "Punchy" }));
      fireEvent.change(screen.getByLabelText("Seed color"), {
        target: { value: "oklch(0.7 0.15 200)" },
      });
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
      cleanup();
    }
  });
});
