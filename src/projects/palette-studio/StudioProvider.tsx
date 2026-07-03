"use client";

// The Palette Studio's shared-state frame. The page wraps the entry's article in this
// provider (the `ProjectModule.Provider` contract), so the studio's slots — mounted as
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
  buildHarmonyPalette,
  type Gamut,
  type HarmonyPalette,
  type Scheme,
} from "@garden/oklch";

import type { ProviderProps } from "@/projects/types";

import {
  derivePalette,
  parseSeed,
  type DerivedPalette,
  type ParsedSeed,
  type SchemeView,
} from "./core/derive";
import { DEFAULT_GAMUT, DEFAULT_RULES, type StudioRules } from "./core/rules";
import { DEFAULT_SEED } from "./core/presets";

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
  /** Decorative harmony sets — seed + gamut only, scheme-independent. */
  readonly harmony: HarmonyPalette;
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
  const harmony = useMemo(
    () => buildHarmonyPalette(seed, { gamut }),
    [seed, gamut],
  );

  const value = useMemo<StudioState>(
    () => ({
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
      view: scheme === "light" ? palette.light : palette.dark,
      harmony,
    }),
    [slug, seed, parsed, rules, gamut, scheme, palette, harmony],
  );

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}
