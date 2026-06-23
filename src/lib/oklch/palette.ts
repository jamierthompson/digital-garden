/**
 * The high-level engine: `brandColor` → contrast-solved, gamut-mapped token sets.
 *
 * Two wrappers over the low-level surface (convert/gamut/contrast):
 *   • `resolveTheme(brandColor, scheme, opts)` → one scheme's tokens [D5 signature]
 *     (Consumer B playground, Consumer C `cardSwatches` — they want one scheme).
 *   • `buildTokenSet(brandColor, opts)` → both schemes zipped into `light-dark()` pairs
 *     (Consumer A `ProjectScope`, which emits a single block carrying both schemes [D5]).
 *
 * Order of operations is fixed by decision: parse defensively [D9] → per-scheme seed
 * (dark = reduced chroma [D5]) → gamut-map [D6] → solve contrast on the mapped color [D4].
 * The engine bakes literals and NEVER throws — bad input yields the fallback palette [D3, D9].
 */

import { gamutMap } from "./gamut";
import { parseColor } from "./convert";
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
  /** Target display gamut [D6]. Defaults to `srgb` (safe everywhere — see types). */
  gamut?: Gamut;
}

/**
 * Fallback brand seed for unparseable input [D9] — a calm slate-blue, in sRGB gamut,
 * chosen so every solved token comfortably clears its target. Deterministic.
 */
const FALLBACK_SEED: OkLCH = { L: 0.55, C: 0.11, H: 264 };

// --- Contrast targets (mirror accessibility-and-performance.md §1 table) --------

const TARGET = {
  /** Body text: WCAG 4.5 floor, APCA Lc 75 quality target [D4]. */
  bodyText: { wcag: 4.5, apca: 75 } satisfies ContrastTarget,
  /** Muted/secondary text: still small-text AA (4.5), lower APCA tier (Lc 60). */
  mutedText: { wcag: 4.5, apca: 60 } satisfies ContrastTarget,
  /** Link/accent text: AA small-text floor (4.5), Lc 60 — the yellow/cyan stresser. */
  accentText: { wcag: 4.5, apca: 60 } satisfies ContrastTarget,
  /** Text on the accent fill: AA small-text (4.5) + APCA "non-body" tier (Lc 60). A
   *  mid-tone fill cannot host Lc-75 body text in either polarity, so the on-brand
   *  label target is the non-body tier; the accent fill is co-solved to host it. */
  onAccent: { wcag: 4.5, apca: 60 } satisfies ContrastTarget,
  /** Accent fill, borders, focus ring: non-text 3:1 (1.4.11), Lc 45 spot-readable [D7]. */
  ui: { wcag: 3, apca: 45 } satisfies ContrastTarget,
  /** Subtle borders: non-text 3:1 floor. */
  border: { wcag: 3, apca: 30 } satisfies ContrastTarget,
} as const;

// --- Surface anchors per scheme -------------------------------------------------
// Surfaces are near-neutral with a whisper of brand tint. Dark surfaces use reduced
// chroma [D5]. Text/accent/border/ring are SOLVED against these, never stepped [D4].

interface SchemeConfig {
  /** Page background lightness. */
  bgL: number;
  /** Elevated surface lightness. */
  surfaceL: number;
  /** Higher elevation lightness. */
  surface2L: number;
  /** Max chroma carried into the near-neutral surfaces (brand tint cap). */
  surfaceChromaCap: number;
  /** Chroma multiplier applied to the brand seed for this scheme (dark dampens) [D5]. */
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
    seedChroma: 0.82, // reduced chroma in dark [D5]
    textChroma: 0.014,
  },
};

/** A near-neutral surface at lightness `L`, tinted toward the brand hue, then mapped. */
function surface(L: number, hue: number, chroma: number, gamut: Gamut): OkLCH {
  return gamutMap({ L, C: chroma, H: hue }, gamut);
}

/**
 * Co-solve the accent FILL and the text that sits ON it. A mid-tone fill can host no
 * high-Lc text in either polarity, so we scan the brand hue across lightness for the
 * fill that (a) stays visible on the worst-case surface (≥3:1 + Lc 45, non-text [D4])
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
  // Should be unreachable, but never return undefined — defensive [D9].
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
 * Resolve every brand token for ONE scheme. The literal `(brandColor, scheme) → tokenSet`
 * of the architecture signature [D5]. Pure, deterministic, never throws [D3, D9].
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

  // Per-scheme seed: hold L/H, dampen chroma in dark, then gamut-map [D6].
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

  const { accent, onAccent } = solveAccent(seed, fgBg, gamut);

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

  return { tokens, seed, gamut, isFallback };
}

const TOKEN_NAMES: readonly BrandTokenName[] = [
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
];

/**
 * Build the dual-scheme token set for `ProjectScope` (Consumer A): resolves both
 * schemes and zips each token into a `{ light, dark }` pair for `light-dark()` [D5].
 * Pure, deterministic, never throws [D3, D9].
 */
export function buildTokenSet(
  brandColor: unknown,
  opts: EngineOptions = {},
): TokenSet {
  const light = resolveTheme(brandColor, "light", opts);
  const dark = resolveTheme(brandColor, "dark", opts);

  const tokens = {} as Record<BrandTokenName, SchemePair>;
  for (const name of TOKEN_NAMES) {
    tokens[name] = { light: light.tokens[name], dark: dark.tokens[name] };
  }

  return {
    tokens,
    meta: {
      seed: { light: light.seed, dark: dark.seed },
      gamut: light.gamut,
      isFallback: light.isFallback,
    },
  };
}
