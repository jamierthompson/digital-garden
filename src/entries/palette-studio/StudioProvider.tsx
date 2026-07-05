"use client";

// The Palette Studio's shared-state frame. The page wraps the entry's article in this
// provider (the `EntryModule.Provider` contract), so the studio's slots — mounted as
// individual `liveEmbed`s interleaved through the server-rendered prose — share one
// state store and ONE engine run per change. The client boundary is this frame plus the
// slot leaves; the prose between slots passes through as server-rendered children.

import {
  createContext,
  useContext,
  useEffect,
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

import { washBgValue } from "@/components/entry-scope/washBg";
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
import styles from "./StudioProvider.module.css";

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

  // Bridge the live seed to the page-spanning wash (`EntryScopeWash` / `scopedWashCss`,
  // `/[slug]/page.tsx`'s CANVAS template). CSS structurally can't do this on its own: the
  // wash's `--bg` lives on `body`, an ANCESTOR of this provider, and the cascade only flows
  // downward — a value computed inside the studio's own scope can never reach back UP to an
  // ancestor via a stylesheet rule (unlike the scrollbar thumb, which reads `--accent` from
  // INSIDE the studio scope and so gets the live value "for free"). This effect is the
  // explicit push the cascade can't provide.
  //
  // Reuses `washBgValue` (`@/components/entry-scope/washBg`) — the SAME chroma treatment
  // `scopedWashCss` bakes into the server-rendered wash from that identical helper (see its
  // STOPGAP note re #160) — so the client-updated wash can never visibly jump from the
  // server one; the Studio's `DEFAULT_SEED` equalling the entry's own `brandColor`
  // (`core/presets.ts`) is what makes this effect's FIRST write match the server-rendered
  // wash exactly, so there is no hydration flash. Imported from `./washBg` directly, NOT
  // from `scopeSeed.ts` — see `washBg.ts`'s file-header comment for why a CLIENT component
  // can't go through `scopeSeed.ts` (its font-resolution import chain isn't mocked here).
  useEffect(() => {
    // Defensive guard matching the rest of this codebase's SSR posture (`resolveScope`'s own
    // never-throw contract) — Next never runs an effect during SSR, so this never actually
    // trips, but it keeps the invariant structural rather than vigilance-dependent.
    if (typeof document === "undefined") return;
    document.body.style.setProperty("--bg", washBgValue(palette.tokenSet));
    return () => {
      // Leak guard: on true unmount (navigating off this canvas route) this clears the
      // inline override so it can never bleed onto a route that never asked for it. On every
      // OTHER re-run (a seed/rules/gamut change) this cleanup fires immediately before the
      // effect re-sets the property to the new value in the same commit — no visible gap.
      document.body.style.removeProperty("--bg");
    };
  }, [palette]);

  return (
    <StudioContext.Provider value={value}>
      {/* The studio's own working surface: re-binds `--bg` (the same `slotStyle` every Panel
          already reads) for its own descendants, so cards/boards still resolve `--bg` if any
          of them read it directly. It no longer PAINTS a background itself (see
          `StudioProvider.module.css`'s `.surface` comment) — the page-spanning wash (bridged
          live above) already covers the whole canvas in this same color. Confined to the
          studio's own subtree; the page-level chrome around it is untouched here (a
          dedicated wide-canvas page template is the planned home for that). */}
      <div className={styles.surface} style={value.slotStyle}>
        {children}
      </div>
    </StudioContext.Provider>
  );
}
