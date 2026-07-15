/**
 * The high-level engine: `themeColor` → per-role `50…950` ramps + the contrast-solved,
 * gamut-mapped semantic token set the ramps bind to.
 *
 * Two wrappers over the low-level surface (convert/gamut/contrast/ramp/binding):
 *   • `resolveTheme(themeColor, scheme, opts)` → one scheme's ramps + tokens
 *     (`cardSwatches`, and the interactive studio #70 — they want one scheme).
 *   • `buildTokenSet(themeColor, opts)` → both schemes zipped into `light-dark()` pairs
 *     (`EntryScope`, which emits a single block carrying both schemes).
 *
 * The model (#98): the engine emits a **per-role generative ramp** — `accent`, `neutral`,
 * and the four status ramps — as 11 `50…950` steps (a pure perceptual-lightness primitive,
 * `ramp.ts`). The semantic role tokens (`--surface`, `--foreground`, …) then **bind to ramp
 * steps** (`binding.ts`) rather than being solved in isolation: surfaces pin a fixed
 * neutral step per scheme, and every "readable-on-surface" token binds to the smallest step
 * that clears its contrast target (`minPass`). The one exception is the accent FILL: it is
 * the accent's own identity, so it stays a faithful continuous co-solve anchored at the
 * seed's lightness (the rare exact solve `solveForeground` exists for), with its accent-foreground
 * label the most chromatic color that clears on the fill (#153 — degrading to a near-white/
 * near-black extreme when the gamut allows no chroma there).
 *
 * Order of operations is fixed: parse defensively → detect the seed's native scheme
 * (auto-direction) → per-scheme seed (dark = reduced chroma) → build the per-scheme ramps →
 * co-solve the accent → resolve the binding schema. The engine bakes literals and NEVER
 * throws — bad input yields the fallback palette.
 *
 * Seed-lightness auto-direction: a single seed represents ONE mode. The engine detects
 * whether the seed is usable as a light-mode primary (clears the UI contrast floor as an
 * accent on a light surface) — if so its native scheme is `light`, otherwise `dark`. In
 * the native scheme the accent is anchored to the seed's own lightness (seed-faithful);
 * in the other scheme it is derived by scanning lightness for a legible accent.
 */

import { buildRamp } from "./ramp";
import {
  resolveTokens,
  type CoSolvedFill,
  type CoSolvedHover,
  type TokenBinding,
} from "./binding";
import {
  solveAccent,
  solveNativeAccent,
  solveStatusFill,
  solveAccentHover,
  describeAccent,
  describeAccentForeground,
  describeFill,
  describeFillForeground,
} from "./accent";
import { gamutMap } from "./gamut";
import { parseColor } from "./convert";
import { checkContrast } from "./contrast";
import { CONTRAST_TARGETS } from "./targets";
import { deepFreeze } from "./freeze";
import { FALLBACK_SEED } from "./seed";
import {
  THEME_TOKEN_NAMES,
  RAMP_ROLES,
  type BindingPair,
  type ThemeTokenName,
  type EngineRules,
  type Gamut,
  type OkLCH,
  type Ramp,
  type RampLabel,
  type RampRole,
  type Scheme,
  type SchemePair,
  type SchemeResult,
  type RampPair,
  type TokenSet,
} from "./types";

export interface EngineOptions {
  /** Target display gamut. Defaults to `srgb` (safe everywhere — see types). */
  gamut?: Gamut;
  /**
   * Generative rules (#101) — lightness distribution, chroma/hue policy, tinted
   * neutrals. Omitted (or any subset omitted) → the documented defaults, which
   * reproduce the un-ruled engine output exactly. The Studio surfaces these (#73).
   */
  rules?: EngineRules;
}

// Status signal colors. The hues are FIXED canonical anchors — NOT derived from the theme
// — because a status color's job is to signal meaning at a glance, and that depends on
// recognizability (error=red is a usability requirement, not a stylistic choice). What
// harmonizes them with the accent is the TREATMENT, not the hue: each gets its own ramp,
// contrast-solved and gamut-mapped against the slot's worst-case surface, per scheme,
// exactly like the accent ramp. (Mirrors the owner's prototype: danger 27 · success 150 ·
// warning 80.)
const STATUS_HUE: Record<"success" | "error" | "warning" | "info", number> = {
  success: 150, // green
  error: 27, // red
  warning: 80, // amber/yellow
  info: 250, // blue
};

// One chroma for every status ramp; per-step gamut-mapping handles the per-hue reality, so
// e.g. warning/yellow correctly desaturates at its dark steps — that is the point of a
// gamut-mapped ramp rather than a uniform ΔL step.
const STATUS_CHROMA = 0.15;

// The four status roles, in the token EMISSION order of the 37-token contract (#160, #229): each
// contributes a fill + fill-foreground + text + subtle + subtle-foreground block.
const STATUS_ROLES = ["error", "warning", "success", "info"] as const;

/**
 * The ramp steps a `<status>-subtle` pins per scheme (#160): a soft tinted alert surface —
 * a light tint in light mode, a dark tint in dark mode. Mirrors the neutral `surface` step
 * (`100`/`900`) on the status hue's own ramp, so a subtle surface reads as a tinted sibling of
 * the elevated surface. Exported as one constant so the `<status>-subtle-foreground` label solves
 * against the EXACT step the subtle surface ships (`auto-on`'s `against`), never an assumed color.
 */
const SUBTLE_STEP: { light: RampLabel; dark: RampLabel } = {
  light: "100",
  dark: "900",
};

/** The scrim's fixed opacity (#160) — the engine's first alpha-carrying literal. A dialog
 *  overlay dims toward black; 0.6 reads as a clear modal veil without fully hiding the page. */
const SCRIM_ALPHA = 0.6;

/**
 * The `scrim` literal (#160): a near-black neutral at a fixed alpha, the dialog/overlay dim
 * layer. Seed-independent (overlays dim toward black in both schemes) and carries NO contrast
 * claim — its only story is opacity. The engine's first translucent token; serializes as
 * `oklch(L C H / a)` (CSS), the `--color-scrim` Tailwind var, and the DTCG `alpha` field.
 */
const SCRIM_COLOR: OkLCH = { L: 0.13, C: 0, H: 0, alpha: SCRIM_ALPHA };

interface SchemeConfig {
  /** Chroma multiplier applied to the theme seed for this scheme (dark dampens). */
  seedChroma: number;
  /** Nominal chroma of the near-neutral ramp — the whisper of accent tint on surfaces/text. */
  neutralChroma: number;
}

const SCHEMES: Record<Scheme, SchemeConfig> = {
  light: {
    seedChroma: 1,
    // A BOLD default neutral tint (#160): the owner wants visibly-tinted surfaces and a
    // deep-accent-toned `foreground` (not near-black), not a whisper. Held flat across the ramp and
    // gamut-mapped per step, so the light surfaces desaturate to a soft tint while the dark
    // text steps keep the full chroma — a deep accent-toned foreground. Owner dials the exact
    // amount; this is the sensibly-bold starting point.
    neutralChroma: 0.04,
  },
  dark: {
    seedChroma: 0.82, // reduced chroma in dark
    neutralChroma: 0.045,
  },
};

/**
 * The baked default binding schema (#98): which ramp step (or fixed value) each semantic
 * token resolves to. Surfaces pin fixed neutral steps — the light end in light mode, the
 * dark end in dark mode (this per-scheme inversion IS the "re-solve per scheme"). Every
 * readable-on-surface token binds via `minPass` against the scheme's worst-case surface.
 * The accent fill / accent-foreground label defer to the faithful accent co-solve. A `literal`
 * binding (a fixed value per scheme, e.g. a pure-white surface) is supported by the schema
 * for a theme that wants one; the default uses stepped surfaces so they carry the tint.
 *
 * EXPORTED read-only (#150) so the Studio can answer, for any `ThemeTokenName`, WHICH kind
 * of binding it is, against WHICH role's ramp, to WHICH `CONTRAST_TARGETS` tier — reading
 * the one mapping the engine solves against rather than hardcoding the 14-row table.
 */
export const DEFAULT_BINDING_SCHEMA: Readonly<
  Record<ThemeTokenName, TokenBinding>
> = deepFreeze({
  // Surfaces: page → elevated → higher, from the near-neutral ramp. Light end in light,
  // dark end in dark. Five surfaces in increasing darkness (light mode): background > surface >
  // surface-elevated > surface-hover > surface-selected; `surface-selected` — the darkest
  // text-bearing surface — is the worst-case background every `auto` token solves against
  // (see `WORST_SURFACE_LABEL`). `surface-hover`/`surface-selected` (#160) pin interior steps,
  // so they float with the #101 distribution; the worst-case solve reads their ACTUAL step.
  background: { kind: "step", role: "neutral", light: "50", dark: "950" },
  surface: { kind: "step", role: "neutral", light: "100", dark: "900" },
  "surface-elevated": {
    kind: "step",
    role: "neutral",
    light: "200",
    dark: "800",
  },
  // `muted` is the neutral member of the "subtle" family — a faint neutral background that pins
  // the SAME step as `surface` (`100`/`900`); distinct role, shared fallback color by design.
  muted: { kind: "step", role: "neutral", light: "100", dark: "900" },
  // Near-neutral foregrounds — bound to the neutral ramp (the accent tint desaturates at the
  // dark steps via gamut-mapping, so any hue clears body-text contrast).
  foreground: {
    kind: "auto",
    role: "neutral",
    target: CONTRAST_TARGETS.bodyText,
  },
  "muted-foreground": {
    kind: "auto",
    role: "neutral",
    target: CONTRAST_TARGETS.mutedText,
  },
  border: { kind: "auto", role: "neutral", target: CONTRAST_TARGETS.border },
  // Accent identity — the faithful continuous accent + its accent-foreground label.
  accent: { kind: "fill", role: "accent" },
  "accent-foreground": { kind: "fill-foreground", role: "accent" },
  // Accent subtle surface + its label — mirrors a `<status>-subtle` pair on the accent ramp, so
  // `accent` is symmetric with the four statuses (a soft accent-tinted surface + a legible label).
  "accent-subtle": {
    kind: "step",
    role: "accent",
    light: SUBTLE_STEP.light,
    dark: SUBTLE_STEP.dark,
  },
  "accent-subtle-foreground": {
    kind: "auto-on",
    role: "accent",
    against: SUBTLE_STEP,
    target: CONTRAST_TARGETS.accentText,
  },
  // accent-colored foregrounds — bound to the full-chroma accent ramp.
  "accent-text": {
    kind: "auto",
    role: "accent",
    target: CONTRAST_TARGETS.accentText,
  },
  ring: { kind: "auto", role: "accent", target: CONTRAST_TARGETS.ui },
  // Status TRIOS + SUBTLES (#160), one block per status role. The FILL is the co-solved
  // signal color (visible on the surface + hosts a label); `<status>-foreground` its chromatic
  // label; `<status>-text` is the accent-text tier solved against surface-elevated;
  // `<status>-subtle` a soft tinted alert surface; `<status>-subtle-foreground` its label,
  // solved against the subtle surface's actual color.
  error: { kind: "fill", role: "error" },
  "error-foreground": { kind: "fill-foreground", role: "error" },
  "error-text": {
    kind: "auto",
    role: "error",
    target: CONTRAST_TARGETS.accentText,
  },
  "error-subtle": {
    kind: "step",
    role: "error",
    light: SUBTLE_STEP.light,
    dark: SUBTLE_STEP.dark,
  },
  "error-subtle-foreground": {
    kind: "auto-on",
    role: "error",
    against: SUBTLE_STEP,
    target: CONTRAST_TARGETS.accentText,
  },
  warning: { kind: "fill", role: "warning" },
  "warning-foreground": { kind: "fill-foreground", role: "warning" },
  "warning-text": {
    kind: "auto",
    role: "warning",
    target: CONTRAST_TARGETS.accentText,
  },
  "warning-subtle": {
    kind: "step",
    role: "warning",
    light: SUBTLE_STEP.light,
    dark: SUBTLE_STEP.dark,
  },
  "warning-subtle-foreground": {
    kind: "auto-on",
    role: "warning",
    against: SUBTLE_STEP,
    target: CONTRAST_TARGETS.accentText,
  },
  success: { kind: "fill", role: "success" },
  "success-foreground": { kind: "fill-foreground", role: "success" },
  "success-text": {
    kind: "auto",
    role: "success",
    target: CONTRAST_TARGETS.accentText,
  },
  "success-subtle": {
    kind: "step",
    role: "success",
    light: SUBTLE_STEP.light,
    dark: SUBTLE_STEP.dark,
  },
  "success-subtle-foreground": {
    kind: "auto-on",
    role: "success",
    against: SUBTLE_STEP,
    target: CONTRAST_TARGETS.accentText,
  },
  info: { kind: "fill", role: "info" },
  "info-foreground": { kind: "fill-foreground", role: "info" },
  "info-text": {
    kind: "auto",
    role: "info",
    target: CONTRAST_TARGETS.accentText,
  },
  "info-subtle": {
    kind: "step",
    role: "info",
    light: SUBTLE_STEP.light,
    dark: SUBTLE_STEP.dark,
  },
  "info-subtle-foreground": {
    kind: "auto-on",
    role: "info",
    against: SUBTLE_STEP,
    target: CONTRAST_TARGETS.accentText,
  },
  // Interaction states (#160). `accent-hover` is a perceptibly-nudged accent fill that still
  // hosts accent-foreground. `surface-hover`/`surface-selected` pin the two neutral state surfaces —
  // interior steps just darker than `surface-elevated` (light) / lighter than `surface-elevated`
  // (dark); `surface-selected` is the worst-case surface `foreground`/`muted-foreground`/`border`
  // are solved on.
  "accent-hover": { kind: "fill-hover", role: "accent" },
  "surface-hover": { kind: "step", role: "neutral", light: "300", dark: "700" },
  "surface-selected": {
    kind: "step",
    role: "neutral",
    light: "400",
    dark: "600",
  },
  // Scrim (#160): the translucent overlay literal.
  scrim: { kind: "literal", light: SCRIM_COLOR, dark: SCRIM_COLOR },
});

/**
 * The label the `surface-selected` step binds to in each scheme — the WORST-CASE surface the
 * `auto` tokens are solved against (#160). `surface-selected` is the DARKEST text-bearing
 * surface (light mode) / lightest (dark mode), so a foreground that clears its target there
 * clears it on EVERY surface — background, surface, surface-elevated, surface-hover included, with no APCA-miss
 * exception. Derived from `DEFAULT_BINDING_SCHEMA["surface-selected"]` itself, so the surface
 * those tokens solve on can never drift from the `surface-selected` token that actually ships
 * (single source of truth; the "AA on every surface" guarantee rests on their being identical).
 * The fallback only fires if the schema retypes `surface-selected` off a step binding — a design
 * change a test would catch.
 */
const WORST_SURFACE_LABEL: { light: RampLabel; dark: RampLabel } =
  DEFAULT_BINDING_SCHEMA["surface-selected"].kind === "step"
    ? {
        light: DEFAULT_BINDING_SCHEMA["surface-selected"].light,
        dark: DEFAULT_BINDING_SCHEMA["surface-selected"].dark,
      }
    : { light: "400", dark: "600" };

/**
 * The default step the seed anchors to, keyed off its native direction (#108): a
 * dark-enough seed (light-native) pins the mid `500`; a light seed (dark-native) pins
 * the light `300`. Fully automatic — no UI control.
 */
const ANCHOR_LABEL: Record<Scheme, RampLabel> = {
  light: "500",
  dark: "300",
};

/** Build all six role ramps for one scheme from a per-scheme seed, on that scheme's OWN
 *  independent lightness scale (#160 — not a mirror of the other scheme). Only the `accent`
 *  ramp is anchored to the seed (#108); neutral/status stay on the scheme scale. The
 *  ramp-tier rules (#101) shape every role; `tintedNeutrals: false` zeroes the neutral
 *  chroma for pure achromatic greys (default `true` — the accent-tinted signature). */
function buildRamps(
  seed: OkLCH,
  scheme: Scheme,
  cfg: SchemeConfig,
  gamut: Gamut,
  rules: EngineRules = {},
  anchor?: { label: RampLabel; L: number },
): Record<RampRole, Ramp> {
  const hue = seed.H;
  const neutralChroma = (rules.tintedNeutrals ?? true) ? cfg.neutralChroma : 0;
  return {
    accent: buildRamp({ hue, chroma: seed.C, gamut, scheme, anchor, rules }),
    neutral: buildRamp({ hue, chroma: neutralChroma, gamut, scheme, rules }),
    success: buildRamp({
      hue: STATUS_HUE.success,
      chroma: STATUS_CHROMA,
      gamut,
      scheme,
      rules,
    }),
    error: buildRamp({
      hue: STATUS_HUE.error,
      chroma: STATUS_CHROMA,
      gamut,
      scheme,
      rules,
    }),
    warning: buildRamp({
      hue: STATUS_HUE.warning,
      chroma: STATUS_CHROMA,
      gamut,
      scheme,
      rules,
    }),
    info: buildRamp({
      hue: STATUS_HUE.info,
      chroma: STATUS_CHROMA,
      gamut,
      scheme,
      rules,
    }),
  };
}

/** The worst-case surface (`surface-selected`, #160) a scheme's neutral ramp resolves to. */
function worstSurfaceOf(ramps: Record<RampRole, Ramp>, scheme: Scheme): OkLCH {
  const label = WORST_SURFACE_LABEL[scheme];
  const step = ramps.neutral.find((s) => s.label === label);
  return (step ?? ramps.neutral[ramps.neutral.length - 1]).color;
}

/**
 * Detect the seed's NATIVE scheme from the seed alone (independent of the scheme being
 * resolved, so both scheme calls agree). The seed is `light`-native when — at its own
 * L/C/H, gamut-mapped, using the LIGHT per-scheme seed (`seedChroma` = 1, so base chroma)
 * — it clears the UI contrast floor (`CONTRAST_TARGETS.ui`) as an accent fill against the light
 * scheme's WORST-CASE surface (`surface-selected` light, the neutral ramp step
 * `resolveTheme` uses). If it clears it can serve as a light-mode primary → `light`; if it is too light to
 * read on a light surface → `dark` (the seed is the dark-mode theme, light-mode derived).
 * Deterministic; reuses the same ramp/contrast/gamut primitives as the solve. Never throws.
 */
function detectDirection(
  base: OkLCH,
  gamut: Gamut,
  rules: EngineRules,
): Scheme {
  const cfg = SCHEMES.light;
  // Mirror resolveTheme's light path: per-scheme seed, its ramps, the worst-case surface.
  const seed = gamutMap(
    { L: base.L, C: base.C * cfg.seedChroma, H: base.H },
    gamut,
  );
  const ramps = buildRamps(seed, "light", cfg, gamut, rules);
  const worstSurface = worstSurfaceOf(ramps, "light");
  // The candidate light-mode primary is the accent anchored at the seed's own lightness.
  const accent = gamutMap({ L: seed.L, C: seed.C, H: seed.H }, gamut);
  return checkContrast(accent, worstSurface, CONTRAST_TARGETS.ui).passes
    ? "light"
    : "dark";
}

/**
 * Resolve every theme token for ONE scheme, plus the per-role ramps they bind to. The
 * literal `(themeColor, scheme) → { ramps, tokens }` of the architecture signature. Also
 * reports the seed's native `direction` (detected from the seed alone, so both scheme calls
 * agree): the accent honors `seed.L` when this scheme IS the native direction, and is
 * derived otherwise. Pure, deterministic, never throws.
 */
export function resolveTheme(
  themeColor: unknown,
  scheme: Scheme,
  opts: EngineOptions = {},
): SchemeResult {
  const gamut: Gamut = opts?.gamut ?? "srgb";
  const rules = opts?.rules ?? {};
  const parsed = parseColor(themeColor);
  const isFallback = parsed === null;
  const base = parsed ?? FALLBACK_SEED;
  const cfg = SCHEMES[scheme];

  // Auto-direction: the seed's native scheme, detected from the seed alone so both
  // scheme calls agree. Drives whether this scheme's accent is faithful or derived.
  const direction = detectDirection(base, gamut, rules);

  // Per-scheme seed: hold L/H, dampen chroma in dark, then gamut-map.
  const seed = gamutMap(
    { L: base.L, C: base.C * cfg.seedChroma, H: base.H },
    gamut,
  );

  // Seed anchor (#108): pin the accent ramp's default step (keyed off the native
  // direction) to the seed's EXACT lightness, so the seed's own color lands on the ramp.
  const anchorLabel = ANCHOR_LABEL[direction];

  // The per-role generative ramps for this scheme — the primitive the tokens bind to.
  const ramps = buildRamps(seed, scheme, cfg, gamut, rules, {
    label: anchorLabel,
    L: seed.L,
  });

  // Foregrounds are solved against the WORST-CASE surface — `surface-selected`, the darkest
  // text-bearing surface (light) / lightest (dark), the one whose lightness is closest to the
  // foreground (#160) — so a token that clears its target there also clears it on background, surface,
  // surface-elevated, and surface-hover. This guarantees AA on EVERY surface, state surfaces included.
  const worstSurface = worstSurfaceOf(ramps, scheme);

  // Native scheme → faithful to seed.L (fall back to the derived scan if no faithful
  // accent hosts a label). Off scheme → derive the accent from the seed by scanning.
  // `usedNative` records which path ACTUALLY produced the fill — so the report says
  // "derived" (not a huge phantom "nudge") on the rare native seed whose faithful solve
  // found no hostable label and fell through to the scan.
  const nativeSolve =
    scheme === direction ? solveNativeAccent(seed, worstSurface, gamut) : null;
  const usedNative = nativeSolve !== null;
  const { accent, accentForeground } =
    nativeSolve ?? solveAccent(seed, worstSurface, gamut);

  // The accent/accent-foreground co-solve provenance (#151): the receipt's truthful source for the
  // accent pair, reported at solve time so the Studio never reverse-engineers native/nudged/
  // derived (or the label pole) by comparing `seed` to `tokens.accent`. Pure functions of the
  // solved colors + which solve path ran — reporting only, no value is perturbed.
  const accentProvenance = describeAccent(accent, seed, usedNative);
  const accentForegroundProvenance = describeAccentForeground(
    accentForeground,
    accent,
    seed,
  );

  // Status fills (#160): the same co-solve as the accent, at each FIXED canonical status hue
  // (seed-independent). `seed: null` in provenance — a status fill has no theme-seed story.
  const fills: Partial<Record<RampRole, CoSolvedFill>> = {
    accent: {
      fill: accent,
      fillForeground: accentForeground,
      fillProvenance: accentProvenance,
      fillForegroundProvenance: accentForegroundProvenance,
    },
  };
  for (const role of STATUS_ROLES) {
    const hue = STATUS_HUE[role];
    const { fill, fillForeground } = solveStatusFill(
      hue,
      STATUS_CHROMA,
      worstSurface,
      gamut,
    );
    fills[role] = {
      fill,
      fillForeground,
      fillProvenance: describeFill(role, hue, null),
      fillForegroundProvenance: describeFillForeground(
        fillForeground,
        fill,
        role,
        hue,
        STATUS_CHROMA,
      ),
    };
  }

  // Interaction-state fills (#160): accent-hover — a perceptibly-nudged accent fill that still
  // reads as UI on the surface AND still hosts accent-foreground. Provenance is an accent fill flagged
  // `native: false` (a derived hover, not the seed anchor), with `deltaL` referenced from the
  // seed so a consumer narrates the shift-from-accent provenance-to-provenance.
  const hoverFill = solveAccentHover(
    accent,
    accentForeground,
    seed,
    worstSurface,
    gamut,
  ).fill;
  const hovers: Partial<Record<RampRole, CoSolvedHover>> = {
    accent: {
      fill: hoverFill,
      provenance: describeFill("accent", seed.H, {
        native: false,
        deltaL: hoverFill.L - seed.L,
      }),
    },
  };

  // Resolve the binding schema: surfaces pin fixed steps, readable tokens run `minPass`,
  // the fills/labels defer to the co-solves above. `bindings` reports the winning step per
  // token (the receipt's truthful source), computed at solve time — not re-derived.
  const { tokens, bindings } = resolveTokens(DEFAULT_BINDING_SCHEMA, {
    scheme,
    ramps,
    worstSurface,
    fills,
    hovers,
  });

  return {
    tokens,
    ramps,
    seed,
    gamut,
    isFallback,
    direction,
    anchorLabel,
    bindings,
  };
}

/**
 * Build a `Record<ThemeTokenName, T>` by calling `value` for every token in the
 * canonical `THEME_TOKEN_NAMES` (types.ts) — since `ThemeTokenName` is DERIVED from
 * that list, "visit every token, exactly once" is a compile-time fact, so the lone
 * `as` here (unavoidable — `Object.fromEntries` is typed to a loose index signature)
 * is sound rather than a blind assertion.
 */
function mapTokens<T>(
  value: (name: ThemeTokenName) => T,
): Record<ThemeTokenName, T> {
  return Object.fromEntries(
    THEME_TOKEN_NAMES.map((name) => [name, value(name)] as const),
  ) as Record<ThemeTokenName, T>;
}

/** Zip both schemes' ramps into a `Record<RampRole, RampPair>` (per-step `light-dark()`). */
function zipRamps(
  light: Record<RampRole, Ramp>,
  dark: Record<RampRole, Ramp>,
): Record<RampRole, RampPair> {
  return Object.fromEntries(
    RAMP_ROLES.map(
      (role) => [role, { light: light[role], dark: dark[role] }] as const,
    ),
  ) as Record<RampRole, RampPair>;
}

/**
 * Build the dual-scheme token set for `EntryScope`: resolves both
 * schemes and zips each token — and each ramp step — into a `{ light, dark }` pair for
 * `light-dark()`. Pure, deterministic, never throws.
 */
export function buildTokenSet(
  themeColor: unknown,
  opts: EngineOptions = {},
): TokenSet {
  const light = resolveTheme(themeColor, "light", opts);
  const dark = resolveTheme(themeColor, "dark", opts);

  // `mapTokens` forces one entry per `ThemeTokenName`, so coverage is type-enforced
  // (no `as` cast at the call site).
  const tokens = mapTokens<SchemePair>((name) => ({
    light: light.tokens[name],
    dark: dark.tokens[name],
  }));

  // Zip each token's per-scheme provenance, mirroring how the token values are zipped.
  const bindings = mapTokens<BindingPair>((name) => ({
    light: light.bindings[name],
    dark: dark.bindings[name],
  }));

  return {
    tokens,
    ramps: zipRamps(light.ramps, dark.ramps),
    meta: {
      seed: { light: light.seed, dark: dark.seed },
      gamut: light.gamut,
      isFallback: light.isFallback,
      // Detected from the seed alone, so both scheme results agree — pick either.
      direction: light.direction,
      anchorLabel: light.anchorLabel,
      bindings,
    },
  };
}
