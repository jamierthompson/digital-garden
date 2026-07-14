// The per-entry font roster. A curated `next/font` face per `FontKey`, declared once here and
// resolved by key against an entry's `theme.{headingFont,bodyFont,monoFont}` (see
// `src/lib/resolvers/fonts.ts`). The entry scope mounts each resolved face's `.variable` className
// on its `[data-entry]` wrapper and maps that role's token (`--font-heading` / `--font-body` /
// `--font-mono`) to it.
//
// next/font must be called at module scope, so the roster is a fixed code-side set — an editor
// names one of its keys, never an arbitrary font (the Studio field is free-text, validated against
// the roster by the `published-keys` drift net). Declaration ≠ download (a face is only fetched
// when text renders it), so a large roster is cheap.
//
// POLICY (do not change without revisiting the font preload rationale):
//   • `preload: false` on EVERY face — the default is `true`. Only the 1–2 shell faces
//     (root layout) preload; `fontKey` is a runtime index next/font can't statically
//     target anyway, so an above-the-fold face is preloaded via a manual
//     `<link rel="preload" as="font" crossorigin>`, not by flipping this.
//   • `display: "swap"` — zero-CLS via next/font's size-adjusted fallback.

import {
  Fraunces,
  Inter,
  JetBrains_Mono,
  Newsreader,
  Space_Grotesk,
} from "next/font/google";

import type { FontKey } from "@/lib/keys";

/**
 * The CSS generic family a face belongs to — its own classification, NOT the role it happens to
 * fill. `EntryScope` tails this after the face var so the terminal fallback matches the authored
 * face (a serif heading falls back to `serif`, not the heading role's site-default `sans-serif`).
 * All three values are valid CSS generic keywords, so the emitted `var(<face>), <category>` is well-formed.
 */
export type FontCategory = "serif" | "sans-serif" | "monospace";

/** What a resolved roster face exposes to a consumer (e.g. `EntryScope`). */
export interface FontFace {
  /** The `next/font`-generated className that declares the CSS variable; mount it on the `[data-entry]` scope wrapper. */
  readonly variable: string;
  /** The CSS custom-property name this face is bound to; the scope maps a role token (e.g. `--font-heading: var(<this>)`) to it. */
  readonly cssVariable: string;
  /** The face's own CSS generic family; the scope tails it after the face var as the terminal fallback. */
  readonly category: FontCategory;
}

// The `*_VAR` const is the single source for the FontFace map's `cssVariable` below — but
// it CANNOT be passed to the next/font loader call: static analysis requires loader argument
// values to be *explicitly written literals*, not references (build error: "Font loader
// values must be explicitly written literals" — SWC font plugin, Next 16.2.9). So each
// loader's `variable:` repeats the SAME string as its `*_VAR` const, and `roster.test.ts`
// asserts the two agree. DO NOT "DRY this up" by passing the const into the loader — that
// re-breaks the build.
const INTER_VAR = "--font-inter";
const NEWSREADER_VAR = "--font-newsreader";
const FRAUNCES_VAR = "--font-fraunces";
const SPACE_GROTESK_VAR = "--font-space-grotesk";
const JETBRAINS_MONO_VAR = "--font-jetbrains-mono";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-inter", // must equal INTER_VAR (next/font literal constraint)
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-newsreader", // must equal NEWSREADER_VAR
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-fraunces", // must equal FRAUNCES_VAR
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-space-grotesk", // must equal SPACE_GROTESK_VAR
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-jetbrains-mono", // must equal JETBRAINS_MONO_VAR
});

/**
 * `FontKey → FontFace`. `satisfies Record<FontKey, FontFace>` makes a missing
 * face a **compile error** the moment a key is added to `FONT_KEYS`. The
 * resolver (`src/lib/resolvers/fonts.ts`) adds the runtime `NotFound` path for an
 * unknown string coming from Sanity.
 */
export const FONT_FACES = {
  inter: {
    variable: inter.variable,
    cssVariable: INTER_VAR,
    category: "sans-serif",
  },
  newsreader: {
    variable: newsreader.variable,
    cssVariable: NEWSREADER_VAR,
    category: "serif",
  },
  fraunces: {
    variable: fraunces.variable,
    cssVariable: FRAUNCES_VAR,
    category: "serif",
  },
  "space-grotesk": {
    variable: spaceGrotesk.variable,
    cssVariable: SPACE_GROTESK_VAR,
    category: "sans-serif",
  },
  "jetbrains-mono": {
    variable: jetbrainsMono.variable,
    cssVariable: JETBRAINS_MONO_VAR,
    category: "monospace",
  },
} satisfies Record<FontKey, FontFace>;
