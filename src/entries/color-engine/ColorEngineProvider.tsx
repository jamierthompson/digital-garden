"use client";

// The Color Engine's shared-state frame. The page wraps the entry's article in this
// provider (the `EntryModule.Provider` contract), so the Color Engine's slots — mounted as
// individual `liveEmbed`s interleaved through the server-rendered prose — share one
// state store and ONE engine run per change. The client boundary is this frame plus the
// slot leaves; the prose between slots passes through as server-rendered children.

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  buildHarmonyTier,
  type Gamut,
  type HarmonyTier,
  type Scheme,
} from "@garden/oklch";

import ThemeReapplier from "@/components/theme/ThemeReapplier";
import {
  getResolvedScheme,
  subscribe as subscribeToScheme,
} from "@/lib/scheme";
import { tokenSetToThemeDeclarations } from "@/lib/theme";
import type { ProviderProps } from "@/entries/types";

import {
  derivePalette,
  parseSeed,
  type DerivedPalette,
  type ParsedSeed,
  type SchemeView,
} from "./core/derive";
import {
  DEFAULT_GAMUT,
  DEFAULT_RULES,
  type ColorEngineRules,
} from "./core/rules";
import { DEFAULT_SEED } from "./core/presets";
import { tokensPairToScopeVars } from "./core/scope";
import styles from "./ColorEngineProvider.module.css";

export interface ColorEngineState {
  /** Slug-derived id namespace — ids must not collide across Activity-kept routes. */
  readonly idPrefix: string;
  readonly seed: string;
  readonly setSeed: (seed: string) => void;
  /** The seed as the engine parses it (gamut-mapped echo for the readout). */
  readonly parsed: ParsedSeed;
  readonly rules: ColorEngineRules;
  readonly patchRules: (patch: Partial<ColorEngineRules>) => void;
  readonly gamut: Gamut;
  readonly setGamut: (gamut: Gamut) => void;
  /**
   * The scheme the single-scheme slots display (boards, token table). Follows the
   * viewer's color scheme — there is no page-local toggle by design (the toggle is
   * site-wide chrome, #133); when that control lands it re-binds this same signal.
   */
  readonly scheme: Scheme;
  /** The single engine run per state change — every slot reads this one result. */
  readonly palette: DerivedPalette;
  /** The displayed scheme's view of `palette`. */
  readonly view: SchemeView;
  /**
   * The batteries-included decorative harmony TIER (#152) — the 7 derived hues, each with its
   * own `50…950` ramp + receipt-grade text/fill picks, per scheme. Rules- and gamut-treated
   * like the brand; the harmony card group reads the active scheme's picks. Non-contract-bearing
   * (kept out of the guarded token set), so it lives alongside `palette`, not inside it.
   */
  readonly harmonyTier: HarmonyTier;
  /**
   * Inline semantic-token re-bind for a slot's container: the CURRENT seed's generated
   * palette (displayed scheme), as CSS custom properties. Every slot passes this to its
   * Panel so the Color Engine's own chrome — pills, switch, tabs, borders — repaints live with
   * the palette it generates (the tool demonstrates itself). Safe by construction: the
   * engine's output is contrast-solved and never throws (garbage seed → fallback), and
   * inline custom props are ordinary downward theming within the slot's brand scope.
   */
  readonly slotStyle: React.CSSProperties;
}

// Null default on purpose: a slot can be authored into any entry's body, so it must
// degrade to a visible placeholder when no Color Engine frame is mounted (see `useColorEngine`).
const ColorEngineContext = createContext<ColorEngineState | null>(null);

/**
 * Read the Color Engine frame's shared state. Returns `null` when the slot is mounted with no
 * `ColorEngineProvider` above it (a `liveEmbed` authored outside the Color Engine entry) — the slot
 * renders its placeholder instead of crashing the essay.
 */
export function useColorEngine(): ColorEngineState | null {
  return useContext(ColorEngineContext);
}

export default function ColorEngineProvider({
  slug,
  children,
}: ProviderProps): React.ReactElement {
  const [seed, setSeed] = useState<string>(DEFAULT_SEED);
  const [rules, setRules] = useState<ColorEngineRules>(DEFAULT_RULES);
  const [gamut, setGamut] = useState<Gamut>(DEFAULT_GAMUT);
  // Server snapshot is "light" (the shell's default); the client corrects on mount and
  // tracks the site-wide RESOLVED scheme (#162) — the toggle's override when set, else
  // the OS preference — so the receipts always describe the scheme actually painted.
  const scheme = useSyncExternalStore(
    subscribeToScheme,
    getResolvedScheme,
    () => "light" as const,
  );

  // Gamut-map the readout into the palette's gamut so it echoes the exact in-gamut seed
  // the palette derives from — not the parser's half-clamped raw value (QA-BR).
  const parsed = useMemo(() => parseSeed(seed, gamut), [seed, gamut]);
  // The single engine run per state change — a scheme toggle must NOT re-derive. #41
  // memoizes the engine itself; this is the idiomatic guard.
  const palette = useMemo(
    () => derivePalette(seed, rules, gamut),
    [seed, rules, gamut],
  );
  // The decorative tier reads the same rules as the palette (its ramps are shaped like brand).
  const harmonyTier = useMemo(
    () => buildHarmonyTier(seed, { gamut, rules }),
    [seed, gamut, rules],
  );

  const value = useMemo<ColorEngineState>(() => {
    const view = scheme === "light" ? palette.light : palette.dark;
    return {
      idPrefix: `ce-${slug}`,
      seed,
      setSeed,
      parsed,
      rules,
      patchRules: (patch) => setRules((prev) => ({ ...prev, ...patch })),
      gamut,
      setGamut,
      scheme,
      palette,
      view,
      harmonyTier,
      // Both schemes baked into `light-dark()` and NO inline `color-scheme` — the browser picks
      // the scheme at first paint (following the inherited root `color-scheme`, #159), so the
      // Color Engine never paints light-first-then-corrects. Depends on `palette` only, not `scheme`.
      slotStyle: tokensPairToScopeVars(
        palette.light.tokens,
        palette.dark.tokens,
      ),
    };
  }, [slug, seed, parsed, rules, gamut, scheme, palette, harmonyTier]);

  // The live play theme: the generated palette's full semantic token set, as the imperative
  // `<html>` declarations #172's re-applier stamps. Playing (a seed/rules/gamut change) re-runs
  // the engine, so `palette` gets a fresh identity, this memo recomputes, and `ThemeReapplier`
  // re-stamps `<html>` — repainting the WHOLE page, chrome included (SiteNav/SiteFooter sit in
  // the root layout and only inherit from `<html>`, which no downward scope rule can reach).
  //
  // Ephemeral by construction: React state only, no `localStorage`, so a hard reload discards it
  // and the page returns to its authored theme (baked by the route's `<html>` inline script). It
  // can't bleed onto another route either — the re-applier only re-stamps while this canvas is
  // mounted, and every authored route re-asserts its own theme on navigation/reveal. Uses the
  // engine's own `tokenSetToDeclarations` (via `tokenSetToThemeDeclarations`), the same
  // derivation the authored `PageTheme` path bakes, so the client re-stamp and the server theme
  // are byte-identical for a given palette (`DEFAULT_RULES`/`DEFAULT_GAMUT` reproduce the
  // un-ruled engine output bit-for-bit — see `core/rules.ts`). First paint therefore never
  // flashes: the Color Engine's `DEFAULT_SEED` equals the page's authored `brandColor`
  // (`core/presets.ts`), so this memo's first declarations match what `<html>` already painted.
  const themeDeclarations = useMemo(
    () => tokenSetToThemeDeclarations(palette.tokenSet),
    [palette],
  );

  return (
    <ColorEngineContext.Provider value={value}>
      {/* Drives the page's `<html>` theme off the live play palette — the ephemeral,
          page-local override that repaints the whole page (chrome included) as the seed moves. */}
      <ThemeReapplier declarations={themeDeclarations} />
      {/* The Color Engine's own working surface: re-binds the semantic tokens (`slotStyle`, both
          schemes baked into `light-dark()`) for its own descendants, so cards/boards resolve
          `--bg`/`--surface`/… from the live palette. It paints no background itself (see
          `ColorEngineProvider.module.css`'s `.surface` comment) — the page's `--bg`, stamped on
          `<html>` above, already covers the whole canvas in this same color. */}
      <div className={styles.surface} style={value.slotStyle}>
        {children}
      </div>
    </ColorEngineContext.Provider>
  );
}
