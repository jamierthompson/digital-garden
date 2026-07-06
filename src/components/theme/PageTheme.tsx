import { resolveThemeDeclarations, themeInitScript } from "@/lib/theme";

import InlineScript from "./InlineScript";
import ThemeReapplier from "./ThemeReapplier";

interface PageThemeProps {
  /**
   * The page's authored theme seed (a `brandColor` from Sanity, or the `/color-engine` play
   * seed). Untrusted — the engine collapses an unparseable seed to a safe fallback, so this
   * never throws.
   */
  seed: unknown;
}

/**
 * A page mounts this once to wear its authored theme flash-free. A **synchronous** Server
 * Component (mirrors `EntryScope`'s posture — awaits nothing, prerenders into the static shell,
 * unit-testable in jsdom): it resolves the seed to declarations once and drives both halves of
 * the flash-free pattern from that single resolution —
 *
 *   1. `InlineScript` — the parse-time hard-load script that stamps `<html>` before first paint.
 *   2. `ThemeReapplier` — the client re-applier that re-stamps on soft nav / `<Activity>` reveal.
 *
 * There is deliberately no per-route `<style>` block: the theme is a single imperative write to
 * `<html>`, which cannot collide across `<Activity>`-kept routes the way a `:root` block does.
 *
 * Additive by design — nothing renders it into the live layout yet (that flip is #175). Its
 * seed source and the persistent themed chrome it pairs with arrive in later slices.
 */
export default function PageTheme({ seed }: PageThemeProps) {
  const declarations = resolveThemeDeclarations(seed);
  return (
    <>
      <InlineScript html={themeInitScript(declarations)} />
      <ThemeReapplier declarations={declarations} />
    </>
  );
}
