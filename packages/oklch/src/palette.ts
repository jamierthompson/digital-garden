/**
 * The high-level engine: `brandColor` → contrast-solved, gamut-mapped token sets.
 *
 * Two wrappers over the low-level surface (convert/gamut/contrast):
 *   • `resolveTheme(brandColor, scheme, opts)` → one scheme's tokens
 *     (Consumer B playground, Consumer C `cardSwatches` — they want one scheme).
 *   • `buildTokenSet(brandColor, opts)` → both schemes zipped into `light-dark()` pairs
 *     (Consumer A `ProjectScope`, which emits a single block carrying both schemes).
 *
 * Order of operations is fixed: parse defensively → detect the seed's native scheme
 * (auto-direction) → per-scheme seed (dark = reduced chroma) → gamut-map → solve contrast
 * on the mapped color. The engine bakes literals and NEVER throws — bad input yields the
 * fallback palette.
 *
 * Seed-lightness auto-direction: a single seed represents ONE mode. The engine detects
 * whether the seed is usable as a light-mode primary (clears the UI contrast floor as an
 * accent on a light surface) — if so its native scheme is `light`, otherwise `dark`. In
 * the native scheme the accent is anchored to the seed's own lightness (brand-faithful);
 * in the other scheme it is derived by scanning lightness for a legible accent.
 */

import { gamutMap } from "./gamut";
import { clamp01, parseColor } from "./convert";
import {
  apcaLc,
  contrastWCAG,
  solveForeground,
  type ContrastTarget,
} from "./contrast";
import type {
  BrandTokenName,
  Gamut,
  OkLCH,
  Scheme,
  SchemePair,
  SchemeResult,
  SchemeTokens,
  TokenSet,
} from "./types";

export interface EngineOptions {
  /** Target display gamut. Defaults to `srgb` (safe everywhere — see types). */
  gamut?: Gamut;
}

/**
 * Fallback brand seed for unparseable input — a calm slate-blue, in sRGB gamut,
 * chosen so every solved token comfortably clears its target. Deterministic.
 */
const FALLBACK_SEED: OkLCH = { L: 0.55, C: 0.11, H: 264 };

// Contrast targets mirror accessibility-and-performance.md table.
const TARGET = {
  /** Body text: WCAG 4.5 floor, APCA Lc 75 quality target. */
  bodyText: { wcag: 4.5, apca: 75 } satisfies ContrastTarget,
  /** Muted/secondary text: still small-text AA (4.5), lower APCA tier (Lc 60). */
  mutedText: { wcag: 4.5, apca: 60 } satisfies ContrastTarget,
  /** Link/accent text: AA small-text floor (4.5), Lc 60 — the yellow/cyan stresser. */
  accentText: { wcag: 4.5, apca: 60 } satisfies ContrastTarget,
  /** Text on the accent fill: AA small-text (4.5) + APCA "non-body" tier (Lc 60). A
   *  mid-tone fill cannot host Lc-75 body text in either polarity, so the on-brand
   *  label target is the non-body tier; the accent fill is co-solved to host it. */
  onAccent: { wcag: 4.5, apca: 60 } satisfies ContrastTarget,
  /** Accent fill, borders, focus ring: non-text 3:1 (1.4.11), Lc 45 spot-readable. The
   *  focus-ring color is an engine token (contrast-solved per slot); ring geometry stays global. */
  ui: { wcag: 3, apca: 45 } satisfies ContrastTarget,
  /** Subtle borders: non-text 3:1 floor. */
  border: { wcag: 3, apca: 30 } satisfies ContrastTarget,
} as const;

// Surfaces are near-neutral with a whisper of brand tint. Dark surfaces use reduced
// chroma. Text/accent/border/ring are SOLVED against these, never stepped.

interface SchemeConfig {
  /** Page background lightness. */
  bgL: number;
  /** Elevated surface lightness. */
  surfaceL: number;
  /** Higher elevation lightness. */
  surface2L: number;
  /** Max chroma carried into the near-neutral surfaces (brand tint cap). */
  surfaceChromaCap: number;
  /** Chroma multiplier applied to the brand seed for this scheme (dark dampens). */
  seedChroma: number;
  /** Chroma used for near-neutral body/muted text (small brand tint). */
  textChroma: number;
}

const SCHEMES: Record<Scheme, SchemeConfig> = {
  light: {
    bgL: 0.985,
    surfaceL: 0.965,
    surface2L: 0.94,
    surfaceChromaCap: 0.008,
    seedChroma: 1,
    textChroma: 0.012,
  },
  dark: {
    bgL: 0.17,
    surfaceL: 0.215,
    surface2L: 0.26,
    surfaceChromaCap: 0.014,
    seedChroma: 0.82, // reduced chroma in dark
    textChroma: 0.014,
  },
};

/** A near-neutral surface at lightness `L`, tinted toward the brand hue, then mapped. */
function surface(L: number, hue: number, chroma: number, gamut: Gamut): OkLCH {
  return gamutMap({ L, C: chroma, H: hue }, gamut);
}

/**
 * Detect the seed's NATIVE scheme from the seed alone (independent of the scheme being
 * resolved, so both scheme calls agree). The seed is `light`-native when — at its own
 * L/C/H, gamut-mapped, using the LIGHT per-scheme seed (`seedChroma` = 1, so base chroma)
 * — it clears the UI contrast floor (`TARGET.ui`) as an accent fill against the light
 * scheme's WORST-CASE surface (`surface-2` light, built exactly as `resolveTheme` builds
 * it). If it clears it can serve as a light-mode primary → `light`; if it is too light to
 * read on a light surface → `dark` (the seed is the dark-mode brand, light-mode derived).
 * Deterministic; reuses the same contrast/gamut primitives as the solve. Never throws.
 */
function detectDirection(base: OkLCH, gamut: Gamut): Scheme {
  const cfg = SCHEMES.light;
  // Mirror resolveTheme's light path: per-scheme seed, then the worst-case surface.
  const seed = gamutMap(
    { L: base.L, C: base.C * cfg.seedChroma, H: base.H },
    gamut,
  );
  const hue = seed.H;
  const surface2 = surface(
    cfg.surface2L,
    hue,
    Math.min(seed.C, cfg.surfaceChromaCap * 1.4),
    gamut,
  );
  // The candidate light-mode primary is the accent anchored at the seed's own lightness.
  const accent = gamutMap({ L: seed.L, C: seed.C, H: hue }, gamut);
  const clearsUi =
    contrastWCAG(accent, surface2) >= TARGET.ui.wcag &&
    apcaLc(accent, surface2) >= TARGET.ui.apca;
  return clearsUi ? "light" : "dark";
}

/**
 * Co-solve the accent FILL and the text that sits ON it. A mid-tone fill can host no
 * high-Lc text in either polarity, so we scan the brand hue across lightness for the
 * fill that (a) stays visible on the worst-case surface (≥3:1 + Lc 45, non-text)
 * and (b) lets a near-white OR near-black label clear the on-accent target — preferring
 * the MOST chromatic (most brand-faithful) such fill. Deterministic, always returns a
 * usable pair (a deep/bright saturated fill always hosts a high-contrast label).
 */
function solveAccent(
  seed: OkLCH,
  surfaceBg: OkLCH,
  gamut: Gamut,
): { accent: OkLCH; onAccent: OkLCH } {
  const hue = seed.H;
  const target = TARGET.onAccent;
  const labels = [
    gamutMap({ L: 0.99, C: 0, H: hue }, gamut), // near-white
    gamutMap({ L: 0.1, C: 0, H: hue }, gamut), // near-black
  ];

  let best: {
    accent: OkLCH;
    onAccent: OkLCH;
    chroma: number;
    lc: number;
  } | null = null;
  let fallback: { accent: OkLCH; onAccent: OkLCH; lc: number } | null = null;

  for (let L = 0.3; L <= 0.8 + 1e-9; L += 0.01) {
    const accent = gamutMap({ L, C: seed.C, H: hue }, gamut);
    // The fill must read as a UI element against the surface (non-text 3:1 / Lc 45).
    if (contrastWCAG(accent, surfaceBg) < TARGET.ui.wcag) continue;
    if (apcaLc(accent, surfaceBg) < TARGET.ui.apca) continue;

    for (const label of labels) {
      const lc = apcaLc(label, accent);
      // Track the overall best label/fill in case nothing meets target (unreachable).
      if (!fallback || lc > fallback.lc)
        fallback = { accent, onAccent: label, lc };

      if (contrastWCAG(label, accent) >= target.wcag && lc >= target.apca) {
        // Prefer the most chromatic fill; tie-break on label contrast margin.
        if (
          !best ||
          accent.C > best.chroma + 1e-4 ||
          (Math.abs(accent.C - best.chroma) <= 1e-4 && lc > best.lc)
        ) {
          best = { accent, onAccent: label, chroma: accent.C, lc };
        }
      }
    }
  }

  if (best) return { accent: best.accent, onAccent: best.onAccent };
  // Should be unreachable, but never return undefined — defensive.
  if (fallback) return { accent: fallback.accent, onAccent: fallback.onAccent };
  const accent = gamutMap(
    { L: surfaceBg.L >= 0.5 ? 0.45 : 0.7, C: seed.C, H: hue },
    gamut,
  );
  const onAccent = solveForeground({
    bg: accent,
    hue,
    chroma: 0,
    target,
    gamut,
  });
  return { accent, onAccent };
}

/**
 * NATIVE-scheme accent — FAITHFUL to the seed's own lightness. Anchor the fill at
 * `seed.L` (the per-scheme dampened `seed.C`), verify it still reads as a UI element on
 * the worst-case surface, and host a legible near-white/near-black on-accent label. When
 * a mid-lightness `seed.L` can host no label, nudge L minimally toward the nearer extreme
 * (away from mid) — staying as close to `seed.L` as possible — until a label clears while
 * the UI floor still holds. Returns `null` if nothing works (so the caller falls back to
 * the derived scan); this should not happen for a genuinely native seed. Never throws.
 */
function solveNativeAccent(
  seed: OkLCH,
  surfaceBg: OkLCH,
  gamut: Gamut,
): { accent: OkLCH; onAccent: OkLCH } | null {
  const hue = seed.H;
  const target = TARGET.onAccent;
  const labels = [
    gamutMap({ L: 0.99, C: 0, H: hue }, gamut), // near-white
    gamutMap({ L: 0.1, C: 0, H: hue }, gamut), // near-black
  ];
  // Move away from mid-lightness (toward the nearer extreme): that both keeps the fill
  // reading on the surface and strengthens one label polarity. delta 0 = fully faithful.
  const sign = seed.L >= 0.5 ? 1 : -1;

  for (let delta = 0; delta <= 0.5 + 1e-9; delta += 0.01) {
    const L = clamp01(seed.L + sign * delta);
    const accent = gamutMap({ L, C: seed.C, H: hue }, gamut);
    // The fill must still read as a UI element against the worst-case surface.
    const readsOnSurface =
      contrastWCAG(accent, surfaceBg) >= TARGET.ui.wcag &&
      apcaLc(accent, surfaceBg) >= TARGET.ui.apca;
    if (readsOnSurface) {
      for (const label of labels) {
        if (
          contrastWCAG(label, accent) >= target.wcag &&
          apcaLc(label, accent) >= target.apca
        ) {
          return { accent, onAccent: label };
        }
      }
    }
    // Once L pins to an extreme, further deltas can't move it — stop scanning.
    if (L <= 0 || L >= 1) break;
  }

  return null;
}

/**
 * Resolve every brand token for ONE scheme. The literal `(brandColor, scheme) → tokenSet`
 * of the architecture signature. Also reports the seed's native `direction` (detected from
 * the seed alone, so both scheme calls agree): the accent honors `seed.L` when this scheme
 * IS the native direction, and is derived otherwise. Pure, deterministic, never throws.
 */
export function resolveTheme(
  brandColor: unknown,
  scheme: Scheme,
  opts: EngineOptions = {},
): SchemeResult {
  const gamut: Gamut = opts.gamut ?? "srgb";
  const parsed = parseColor(brandColor);
  const isFallback = parsed === null;
  const base = parsed ?? FALLBACK_SEED;
  const cfg = SCHEMES[scheme];

  // Auto-direction: the seed's native scheme, detected from the seed alone so both
  // scheme calls agree. Drives whether this scheme's accent is faithful or derived.
  const direction = detectDirection(base, gamut);

  // Per-scheme seed: hold L/H, dampen chroma in dark, then gamut-map.
  const seed = gamutMap(
    { L: base.L, C: base.C * cfg.seedChroma, H: base.H },
    gamut,
  );
  const hue = seed.H;

  const bg = surface(
    cfg.bgL,
    hue,
    Math.min(seed.C, cfg.surfaceChromaCap),
    gamut,
  );
  const surfaceTok = surface(
    cfg.surfaceL,
    hue,
    Math.min(seed.C, cfg.surfaceChromaCap),
    gamut,
  );
  const surface2 = surface(
    cfg.surface2L,
    hue,
    Math.min(seed.C, cfg.surfaceChromaCap * 1.4),
    gamut,
  );

  // Foregrounds are solved against the WORST-CASE surface — the one whose lightness is
  // closest to the foreground (surface-2 in both schemes) — so a token that clears its
  // target there also clears it on bg and surface. This guarantees AA on EVERY surface,
  // not just the page background.
  const fgBg = surface2;

  // Native scheme → faithful to seed.L (fall back to the derived scan if no faithful
  // accent hosts a label). Off scheme → derive the brand from the seed by scanning.
  const { accent, onAccent } =
    scheme === direction
      ? (solveNativeAccent(seed, fgBg, gamut) ?? solveAccent(seed, fgBg, gamut))
      : solveAccent(seed, fgBg, gamut);

  const tokens: SchemeTokens = {
    bg,
    surface: surfaceTok,
    "surface-2": surface2,
    text: solveForeground({
      bg: fgBg,
      hue,
      chroma: cfg.textChroma,
      target: TARGET.bodyText,
      gamut,
    }),
    "text-muted": solveForeground({
      bg: fgBg,
      hue,
      chroma: cfg.textChroma,
      target: TARGET.mutedText,
      gamut,
    }),
    border: solveForeground({
      bg: fgBg,
      hue,
      chroma: Math.min(seed.C, 0.05),
      target: TARGET.border,
      gamut,
    }),
    accent,
    "accent-text": solveForeground({
      bg: fgBg,
      hue,
      chroma: seed.C,
      target: TARGET.accentText,
      gamut,
    }),
    "on-accent": onAccent,
    "focus-ring": solveForeground({
      bg: fgBg,
      hue,
      chroma: seed.C,
      target: TARGET.ui,
      gamut,
    }),
  };

  return { tokens, seed, gamut, isFallback, direction };
}

// The canonical token order. `satisfies readonly BrandTokenName[]` rejects an
// unknown/misspelled name (the code→type direction); the `_TokenNamesExhaustive`
// guard below rejects a MISSING name (the type→code direction).
const TOKEN_NAMES = [
  "bg",
  "surface",
  "surface-2",
  "text",
  "text-muted",
  "border",
  "accent",
  "accent-text",
  "on-accent",
  "focus-ring",
] as const satisfies readonly BrandTokenName[];

// Compile-time exhaustiveness guard: if any `BrandTokenName` is absent from
// `TOKEN_NAMES`, `Exclude<…>` is a non-`never` union, this type resolves to `never`,
// and the `= true` assignment fails to typecheck. Pure type-level — emits nothing.
type _TokenNamesExhaustive =
  Exclude<BrandTokenName, (typeof TOKEN_NAMES)[number]> extends never
    ? true
    : never;
const _TOKEN_NAMES_EXHAUSTIVE: _TokenNamesExhaustive = true;
void _TOKEN_NAMES_EXHAUSTIVE; // referenced so it isn't flagged as unused

/**
 * Build a `Record<BrandTokenName, T>` by calling `value` for every token in
 * `TOKEN_NAMES`. The completeness guarantee comes from the guards on `TOKEN_NAMES`
 * above (exhaustive + no extras), not from this helper: those make "visit every
 * token, exactly once" a compile-time fact, so the lone `as` here (unavoidable —
 * `Object.fromEntries` is typed to a loose index signature) is sound rather than a
 * blind assertion.
 */
function mapTokens<T>(
  value: (name: BrandTokenName) => T,
): Record<BrandTokenName, T> {
  return Object.fromEntries(
    TOKEN_NAMES.map((name) => [name, value(name)] as const),
  ) as Record<BrandTokenName, T>;
}

/**
 * Build the dual-scheme token set for `ProjectScope` (Consumer A): resolves both
 * schemes and zips each token into a `{ light, dark }` pair for `light-dark()`.
 * Pure, deterministic, never throws.
 */
export function buildTokenSet(
  brandColor: unknown,
  opts: EngineOptions = {},
): TokenSet {
  const light = resolveTheme(brandColor, "light", opts);
  const dark = resolveTheme(brandColor, "dark", opts);

  // `mapTokens` forces one entry per `BrandTokenName`, so coverage is type-enforced
  // (no `as` cast at the call site).
  const tokens = mapTokens<SchemePair>((name) => ({
    light: light.tokens[name],
    dark: dark.tokens[name],
  }));

  return {
    tokens,
    meta: {
      seed: { light: light.seed, dark: dark.seed },
      gamut: light.gamut,
      isFallback: light.isFallback,
      // Detected from the seed alone, so both scheme results agree — pick either.
      direction: light.direction,
    },
  };
}
