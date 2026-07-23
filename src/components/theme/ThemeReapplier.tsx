"use client";

import { useEffect, useLayoutEffect } from "react";

import { applyThemeDeclarations, type ThemeDeclaration } from "@/lib/theme";

// `useLayoutEffect` on the client, `useEffect` on the server — the standard isomorphic guard.
// The write must be a LAYOUT effect (see below); this only silences React's "useLayoutEffect
// does nothing on the server" warning during SSR, where the hoisted `:root` `<style>` owns first
// paint and this effect is a no-op anyway.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface ThemeReapplierProps {
  /** The page's resolved semantic declarations — the seed, already engine-resolved server-side. */
  declarations: ThemeDeclaration[];
}

/**
 * Re-applies the page's theme to `<html>` across client transitions — the soft-nav half of the
 * flash-free pattern (the guide's `LocalDate` mechanism; see `preventing-flash-before-hydration.md`).
 *
 * The hard-load `:root` `<style>` (`ThemeStyle`) themes first paint from the initial HTML; it
 * does NOT re-apply on client navigation (the persistent chrome doesn't reload). This Client
 * Component fills that gap on two events, both of which re-stamp `<html>` with THIS route's seed
 * (an imperative write that out-ranks the `:root` rule, so the visible route always wins):
 *
 *   1. **Soft navigation to this route** — the component mounts, the effect runs.
 *   2. **`<Activity>` reveal** — under Cache Components, Next keeps up to 3 routes mounted and
 *      hides the inactive ones with `display: none` (`preserving-ui-state.md`). Both routes'
 *      trees share the one `<html>`, so on back/forward the revealed route must re-assert its
 *      own theme. React destroys a hidden Activity's effects and re-creates them on reveal —
 *      so a **layout** effect re-runs here and re-stamps from the prop it already holds (no
 *      server round-trip, no `localStorage`).
 *
 * It MUST be a LAYOUT effect, for both reasons: it runs before the browser paints the transition
 * (flash-free), AND — unlike `useInsertionEffect`, which the slice-1 spike proved is NOT part of
 * Activity's hide/show effect cycle and so leaves a revealed route wearing the previous route's
 * theme — a layout effect participates in that cycle. The `declarations` array is a fresh
 * identity each server render, so the effect also re-fires whenever the seed changes (a future
 * ephemeral "play" path, #178, would feed this same component live-recomputed declarations).
 * Renders no DOM.
 */
export default function ThemeReapplier({ declarations }: ThemeReapplierProps) {
  useIsomorphicLayoutEffect(() => {
    applyThemeDeclarations(declarations);
  }, [declarations]);

  return null;
}
