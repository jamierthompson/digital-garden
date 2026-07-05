// The wash's `--bg` color — split out of `scopeSeed.ts` into its OWN leaf module
// (`@garden/oklch` only, no font resolution) so it can be imported from a CLIENT bundle
// without dragging `scopeSeed.ts`'s font-resolution import chain along for the ride.
//
// `scopeSeed.ts`'s `resolveScope` pulls in `resolveFontKey` (`@/lib/resolvers/fonts` →
// `@/fonts/roster`), which calls Next's `next/font/google` loader at MODULE scope — a
// build-time-only transform that throws (`Inter is not a function`) outside a real Next.js
// build/dev process. That's fine for `scopeSeed.ts`'s existing callers (`EntryScopeWash`,
// `/[slug]/page.tsx`) — both Server Components, resolved only in that process — but
// `StudioProvider` (`src/entries/palette-studio/`) is a CLIENT component under test in plain
// vitest/jsdom, and needs ONLY the wash color, never the font side of `resolveScope`.
// Importing `scopeSeed.ts` there transitively imported the font loader too and broke every
// test that mounts the Studio module tree. This module is the fix: the wash's bg value lives
// here, isomorphic and dependency-light, and BOTH `scopeSeed.ts` (`scopedWashCss`, the
// server-rendered wash) and `StudioProvider` (the live bridge) import it from here — one
// shared derivation, reachable from either side without the font tripwire.

import { formatOklch, type TokenSet } from "@garden/oklch";

/**
 * The wash's full `--bg` VALUE (both schemes, one `light-dark()` string) for a resolved
 * `TokenSet` — the ONE shared derivation both the server-rendered wash (`scopedWashCss`,
 * `scopeSeed.ts`) and the Studio's live bridge (`StudioProvider`) build from, so the static
 * first-paint wash and the client-updated one can never drift apart.
 *
 * The wash IS the engine's own `bg` token (the near-neutral ramp's extreme step, `bg` binds to
 * neutral "50" light / "950" dark). The engine's raised neutral chroma (#160 — 0.04 light /
 * 0.045 dark, or 0 when `tintedNeutrals: false`) carries the wash's tint directly, so there is
 * no app-layer chroma override: the engine is the single chroma source, and the page wash can
 * never disagree with the `--bg` every surface sits on.
 */
export function washBgValue(tokenSet: TokenSet): string {
  const { light, dark } = tokenSet.tokens.bg;
  return `light-dark(${formatOklch(light)}, ${formatOklch(dark)})`;
}
