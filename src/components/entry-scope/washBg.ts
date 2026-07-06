// The engine's `--bg` value — a leaf module (`@garden/oklch` only, no font resolution) so it can
// be imported from a CLIENT bundle without dragging `scopeSeed.ts`'s font-resolution import
// chain along for the ride.
//
// `scopeSeed.ts` pulls in `resolveFontKey` (`@/lib/resolvers/fonts` → `@/fonts/roster`), which
// calls Next's `next/font/google` loader at MODULE scope — a build-time-only transform that
// throws (`Inter is not a function`) outside a real Next.js build/dev process. `StudioProvider`
// (`src/entries/palette-studio/`) is a CLIENT component under test in plain vitest/jsdom, and
// needs ONLY this `--bg` value, never the font side of `scopeSeed`. Importing `scopeSeed.ts` there
// would transitively import the font loader too and break every test that mounts the Studio
// module tree. This module is the fix: the `--bg` derivation lives here, isomorphic and
// dependency-light, so `StudioProvider`'s live bridge (`palette-studio`) reaches it without the
// font tripwire.

import { formatOklch, type TokenSet } from "@garden/oklch";

/**
 * The full `--bg` VALUE (both schemes, one `light-dark()` string) for a resolved `TokenSet` — the
 * derivation the Studio's live bridge (`StudioProvider`) pushes onto `body`'s `--bg` as the seed
 * changes during play, so the route's first-paint `--bg` (from its `<html>` theme) and the
 * client-updated one can never drift apart.
 *
 * This IS the engine's own `bg` token (the near-neutral ramp's extreme step, `bg` binds to
 * neutral "50" light / "950" dark). The engine's raised neutral chroma (#160 — 0.04 light /
 * 0.045 dark, or 0 when `tintedNeutrals: false`) carries the tint directly, so there is no
 * app-layer chroma override: the engine is the single chroma source, and the live `--bg` can
 * never disagree with the `--bg` every surface sits on.
 */
export function washBgValue(tokenSet: TokenSet): string {
  const { light, dark } = tokenSet.tokens.bg;
  return `light-dark(${formatOklch(light)}, ${formatOklch(dark)})`;
}
