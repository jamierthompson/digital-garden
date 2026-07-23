import { resolveThemeDeclarations } from "@/lib/theme";

import ThemeStyle from "./ThemeStyle";
import ThemeReapplier from "./ThemeReapplier";

interface PageThemeProps {
  /**
   * The page's authored theme seed (an entry's `theme.color`, a `pageThemes` page seed, or a
   * future live "play" seed). Untrusted — the engine collapses an unparseable seed to a safe
   * fallback, so this never throws.
   */
  seed: unknown;
}

/**
 * A page mounts this once to wear its authored theme flash-free. A **synchronous** Server
 * Component (mirrors `EntryScope`'s posture — awaits nothing, prerenders into the static shell,
 * unit-testable in jsdom): it resolves the seed to declarations once and drives both halves —
 *
 *   1. `ThemeStyle` — the hoisted `:root` `<style>` baked with the seed. React lifts it into
 *      `<head>`, *before* the body chrome, so first paint is themed with no script and no
 *      parse-order dependency (the same server-rendered baked-CSS approach `EntryCard` uses
 *      inline, lifted to `:root`).
 *   2. `ThemeReapplier` — the client re-applier that re-stamps on soft nav / `<Activity>` reveal,
 *      where the persistent chrome doesn't reload. Its imperative `<html>` write out-ranks the
 *      `:root` rule, so the visible route always wins and no per-route `:root` block collides.
 *
 * Every route mounts this to wear its authored theme: site pages resolve their seed from
 * `siteSettings.pageThemes` via `sitePageThemeSeed`, entry pages from `themeSeed`. The persistent
 * chrome (`SiteNav`/`SiteFooter`) inherits the `:root` theme, so it re-matches the visible page.
 */
export default function PageTheme({ seed }: PageThemeProps) {
  const declarations = resolveThemeDeclarations(seed);
  return (
    <>
      <ThemeStyle declarations={declarations} />
      <ThemeReapplier declarations={declarations} />
    </>
  );
}
