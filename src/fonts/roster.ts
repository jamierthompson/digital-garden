// The per-project font roster [D11, §5]. A curated set of `next/font` faces, one
// per `FontKey`, declared once here and resolved by key against the Sanity
// `fontKey` (see `src/lib/resolvers/fonts.ts`). The project scope applies the
// resolved face's `.variable` className on its `[data-project]` wrapper and maps
// `--font-face` to the face's CSS variable; everything beneath reads
// `var(--font-face)` (§3.1, §3.3).
//
// next/font must be called at module scope, so the roster is a fixed code-side
// set — an editor picks from it, never a free-text name [§5]. Two facts keep a
// large roster cheap: declaration ≠ download (a face is only fetched when text
// renders it), and these are NOT preloaded.
//
// POLICY (do not change without revisiting [D11]):
//   • `preload: false` on EVERY face — the default is `true`, so it is set
//     explicitly. Only the 1–2 shell faces (root layout) get `preload: true`.
//     `fontKey` is a runtime index next/font can't statically target for preload
//     anyway; a specific above-the-fold face is preloaded with a manual
//     `<link rel="preload" as="font" crossorigin>`, not by flipping this.
//   • Variable fonts (one file, many weights) — no `weight` needed.
//   • `display: "swap"` — zero-CLS via next/font's size-adjusted fallback; a
//     per-project face swaps on navigation by design.
//   • `subsets: ["latin"]` — subset for size.

import {
  Fraunces,
  Inter,
  JetBrains_Mono,
  Newsreader,
  Space_Grotesk,
} from "next/font/google";

import type { FontKey } from "@/lib/keys";

/**
 * What a resolved roster face exposes to a consumer (e.g. `ProjectScope`).
 * Intentionally minimal: the `.variable` className to mount on the scope, and
 * the CSS custom-property name it defines so the scope can map `--font-face`
 * to it.
 */
export interface FontFace {
  /**
   * The `next/font`-generated className that declares the CSS variable. Apply it
   * on the `[data-project]` scope wrapper so the variable is in scope.
   */
  readonly variable: string;
  /**
   * The CSS custom-property name this face's variable is bound to (the literal
   * passed as the `variable` option). The scope maps `--font-face: var(<this>)`.
   */
  readonly cssVariable: string;
}

// Each face's CSS variable name. The `*_VAR` const is the single source for the
// FontFace map's `cssVariable` below — but it CANNOT be passed to the next/font loader
// call: next/font's compile-time static analysis requires loader argument values to be
// *explicitly written literals*, not references (build error: "Font loader values must
// be explicitly written literals" — the SWC font plugin, Next 16.2.9; every example in
// `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` and this repo's
// own `src/app/layout.tsx` pass the `variable:` inline). So each loader's `variable:`
// repeats the SAME string as its `*_VAR` const, and `roster.test.ts` asserts the two
// agree to catch drift. DO NOT "DRY this up" by passing the const into the loader call
// — that re-breaks the build [D11].
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
 * face a **compile error** the moment a key is added to `FONT_KEYS` [D10]. The
 * resolver (`src/lib/resolvers/fonts.ts`) adds the runtime `NotFound` path for an
 * unknown string coming from Sanity.
 */
export const FONT_FACES = {
  inter: { variable: inter.variable, cssVariable: INTER_VAR },
  newsreader: { variable: newsreader.variable, cssVariable: NEWSREADER_VAR },
  fraunces: { variable: fraunces.variable, cssVariable: FRAUNCES_VAR },
  "space-grotesk": {
    variable: spaceGrotesk.variable,
    cssVariable: SPACE_GROTESK_VAR,
  },
  "jetbrains-mono": {
    variable: jetbrainsMono.variable,
    cssVariable: JETBRAINS_MONO_VAR,
  },
} satisfies Record<FontKey, FontFace>;
