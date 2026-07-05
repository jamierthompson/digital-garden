"use client";

// The Palette Studio's shared-state frame. The page wraps the entry's article in this
// provider (the `EntryModule.Provider` contract), so the studio's slots — mounted as
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

import type { ProviderProps } from "@/entries/types";

import {
  derivePalette,
  parseSeed,
  type DerivedPalette,
  type ParsedSeed,
  type SchemeView,
} from "./core/derive";
import { DEFAULT_GAMUT, DEFAULT_RULES, type StudioRules } from "./core/rules";
import { DEFAULT_SEED } from "./core/presets";
import { tokensPairToScopeVars } from "./core/scope";

export interface StudioState {
  /** Slug-derived id namespace — ids must not collide across Activity-kept routes. */
  readonly idPrefix: string;
  readonly seed: string;
  readonly setSeed: (seed: string) => void;
  /** The seed as the engine parses it (gamut-mapped echo for the readout). */
  readonly parsed: ParsedSeed;
  readonly rules: StudioRules;
  readonly patchRules: (patch: Partial<StudioRules>) => void;
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
   * (kept out of the frozen token set), so it lives alongside `palette`, not inside it.
   */
  readonly harmonyTier: HarmonyTier;
  /**
   * Inline semantic-token re-bind for a slot's container: the CURRENT seed's generated
   * palette (displayed scheme), as CSS custom properties. Every slot passes this to its
   * Panel so the studio's own chrome — pills, switch, tabs, borders — repaints live with
   * the palette it generates (the tool demonstrates itself). Safe by construction: the
   * engine's output is contrast-solved and never throws (garbage seed → fallback), and
   * inline custom props are ordinary downward theming within the slot's brand scope.
   */
  readonly slotStyle: React.CSSProperties;
}

// Null default on purpose: a slot can be authored into any entry's body, so it must
// degrade to a visible placeholder when no studio frame is mounted (see `useStudio`).
const StudioContext = createContext<StudioState | null>(null);

const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function subscribeToScheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_SCHEME_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readScheme(): Scheme {
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? "dark" : "light";
}

/**
 * Read the studio frame's shared state. Returns `null` when the slot is mounted with no
 * `StudioProvider` above it (a `liveEmbed` authored outside the studio entry) — the slot
 * renders its placeholder instead of crashing the essay.
 */
export function useStudio(): StudioState | null {
  return useContext(StudioContext);
}

export default function StudioProvider({
  slug,
  children,
}: ProviderProps): React.ReactElement {
  const [seed, setSeed] = useState<string>(DEFAULT_SEED);
  const [rules, setRules] = useState<StudioRules>(DEFAULT_RULES);
  const [gamut, setGamut] = useState<Gamut>(DEFAULT_GAMUT);
  // Server snapshot is "light" (the shell's default); the client corrects on mount and
  // tracks live scheme changes. Replaced by the site-wide toggle's signal when #133 lands.
  const scheme = useSyncExternalStore(
    subscribeToScheme,
    readScheme,
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

  const value = useMemo<StudioState>(() => {
    const view = scheme === "light" ? palette.light : palette.dark;
    return {
      idPrefix: `ps-${slug}`,
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
      // studio never paints light-first-then-corrects. Depends on `palette` only, not `scheme`.
      slotStyle: tokensPairToScopeVars(
        palette.light.tokens,
        palette.dark.tokens,
      ),
    };
  }, [slug, seed, parsed, rules, gamut, scheme, palette, harmonyTier]);

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}
