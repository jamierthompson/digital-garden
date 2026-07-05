// The wash's `--bg` color math — split out of `scopeSeed.ts` into its OWN leaf module
// (`@garden/oklch` only, no font resolution) so it can be imported from a CLIENT bundle
// without dragging `scopeSeed.ts`'s font-resolution import chain along for the ride.
//
// `scopeSeed.ts`'s `resolveScope` pulls in `resolveFontKey` (`@/lib/resolvers/fonts` →
// `@/fonts/roster`), which calls Next's `next/font/google` loader at MODULE scope — a
// build-time-only transform that throws (`Inter is not a function`) outside a real Next.js
// build/dev process. That's fine for `scopeSeed.ts`'s existing callers (`EntryScopeWash`,
// `/[slug]/page.tsx`) — both Server Components, resolved only in that process — but
// `StudioProvider` (`src/entries/palette-studio/`) is a CLIENT component under test in plain
// vitest/jsdom, and needs ONLY the wash color math, never the font side of `resolveScope`.
// Importing `scopeSeed.ts` there transitively imported the font loader too and broke every
// test that mounts the Studio module tree. This module is the fix: the color derivation
// lives here, isomorphic and dependency-light, and BOTH `scopeSeed.ts` (`scopedWashCss`, the
// server-rendered wash) and `StudioProvider` (the live bridge) import it from here — one
// shared derivation, reachable from either side without the font tripwire.

import { buildRamp, formatOklch, type TokenSet } from "@garden/oklch";

/**
 * Nominal chroma for the wash's OWN `--bg`, deliberately bolder than the engine's neutral-
 * ramp default (`SCHEMES.{light,dark}.neutralChroma`, `packages/oklch/src/palette.ts` —
 * 0.01 / 0.016, "a whisper of tint" by design for a SURFACE that body text sits on). The
 * wash has no text painted directly on it — SiteNav/SiteFooter/the studio panels all supply
 * their own `--surface` on top — so it can carry far more chroma and still read as a wash,
 * not a surface. This is an APP-LAYER override: it calls the engine's public low-level
 * `buildRamp` directly with a bespoke chroma rather than changing the engine's own neutral-
 * ramp default (`packages/oklch` core is off-limits here — a parallel engine worktree has
 * uncommitted work there). Deliberately high enough to push past the sRGB gamut boundary at
 * the extreme lightness `--bg` sits at (the "50"/"950" steps): the per-step gamut map in
 * `buildRamp` then reduces it to whatever the boundary allows, so the wash always lands on
 * the MOST saturated color that lightness can host for this hue, rather than an arbitrary
 * partial value — the owner then dials the constant, not the mechanism.
 *
 * STOPGAP: app-layer wash chroma for a visible wash today; REMOVE when the engine-level
 * neutralChroma raise lands (#160) — do not leave two chroma sources.
 */
const WASH_NEUTRAL_CHROMA = 0.12;

/**
 * The wash's own `--bg` for one scheme: a resolved `TokenSet`'s per-scheme seed hue (already
 * gamut-mapped + chroma-adjusted by the engine, `meta.seed`), at `WASH_NEUTRAL_CHROMA`,
 * landed on the exact ramp step `bg` binds to (`DEFAULT_BINDING_SCHEMA.bg` — light "50" /
 * dark "950").
 *
 * `chromaPolicy` is left at its engine default (`"flat"`, omitted here) rather than set to
 * `"hold"`: `buildRamp`'s `chromaCurve` is `sin(pi * t) ** exponent` for every non-`"flat"`
 * policy, and `t` is EXACTLY 0 at the "50" step and EXACTLY 1 at the "950" step — the two
 * steps this override lands on — so `sin(0) = sin(pi) = 0` and any `"taper"`/`"hold"` policy
 * would zero out chroma at precisely the step being boosted. `"flat"` is the one policy that
 * holds the nominal chroma at the extremes instead of curving it away from them.
 */
function washBgLiteral(tokenSet: TokenSet, scheme: "light" | "dark"): string {
  const seed = tokenSet.meta.seed[scheme];
  const label = scheme === "light" ? "50" : "950";
  const ramp = buildRamp({
    hue: seed.H,
    chroma: WASH_NEUTRAL_CHROMA,
    gamut: tokenSet.meta.gamut,
  });
  const step = ramp.find((s) => s.label === label);
  // `buildRamp` always returns every `RAMP_LABELS` entry (11 steps, `"50"`…`"950"`), so
  // `step` is always found — the fallback below is defensive scaffolding, not a real
  // branch, matching `resolveScope`'s own never-throw posture.
  return formatOklch(step?.color ?? seed);
}

/**
 * The wash's full `--bg` VALUE (both schemes, one `light-dark()` string) for a resolved
 * `TokenSet` — the ONE shared derivation both the server-rendered wash (`scopedWashCss`,
 * `scopeSeed.ts`) and the Studio's live bridge (`StudioProvider`) build from, so the static
 * first-paint wash and the client-updated one can never drift apart.
 *
 * STOPGAP: app-layer wash chroma for a visible wash today; REMOVE when the engine-level
 * neutralChroma raise lands (#160) — do not leave two chroma sources.
 */
export function washBgValue(tokenSet: TokenSet): string {
  return `light-dark(${washBgLiteral(tokenSet, "light")}, ${washBgLiteral(tokenSet, "dark")})`;
}
