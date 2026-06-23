// Pure, defensive resolution of a project "scope seed" → CSS custom-property tokens.
//
// This is the STUB used by the Phase 0.5 walking skeleton: palettes are HARDCODED
// here. Phase 1 swaps `PALETTES`/`FALLBACK_TOKENS` for the isomorphic OKLCH engine
// (`src/lib/oklch/`) — the engine `(brandColor, scheme) → tokenSet`. The contract this
// module must already honour is the one the engine inherits: it is DEFENSIVE — given a
// missing, malformed, or hostile seed it returns a safe fallback and **NEVER throws**
// `[D9]`. Keeping the resolution pure (no React, no I/O) is what lets us unit-test the
// never-throw guarantee directly in jsdom, instead of fighting an async RSC.

/** A resolved scope: the slug it is keyed on + the tokens to emit for it. */
export interface ResolvedScope {
  /**
   * The selector key. Always one of the known palette slugs or `FALLBACK_SLUG` —
   * never raw user input. This is load-bearing: because an unknown slug collapses to
   * the constant `FALLBACK_SLUG`, the slug we interpolate into the `[data-project="…"]`
   * selector and the `data-project` attribute is ALWAYS a vetted constant, so a hostile
   * slug can never inject into the emitted CSS.
   */
  readonly slug: string;
  /** CSS custom-property declarations to place inside the scoped block. */
  readonly tokens: Readonly<Record<string, string>>;
}

/** The shape the route hands in. Kept loose; `resolveScope` treats input as `unknown`. */
export interface ScopeSeed {
  readonly slug: string;
}

export const FALLBACK_SLUG = "fallback";

// A neutral, always-valid palette. Used whenever the seed is missing/garbage so a
// data-quality problem degrades to "unthemed but readable", never a crash `[D9]`.
const FALLBACK_TOKENS: Readonly<Record<string, string>> = {
  "--brand-accent": "oklch(0.55 0 0)",
  "--brand-accent-contrast": "oklch(0.99 0 0)",
  "--brand-surface": "oklch(0.97 0 0)",
  "--brand-on-surface": "oklch(0.22 0 0)",
  "--focus-ring-color": "oklch(0.55 0 0)",
  // Reuse an already-loaded shell face (mono) — NOT a new `next/font` import, so the
  // `preload:false` policy is untouched `[D11]`. Phase 1 maps `roster[fontKey].variable`.
  "--font-face": "var(--font-geist-mono), ui-monospace, monospace",
};

// Hardcoded per-slug palettes. The one walking-skeleton module is `oklch-engine` (blue).
const PALETTES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "oklch-engine": {
    "--brand-accent": "oklch(0.62 0.21 264)",
    "--brand-accent-contrast": "oklch(0.98 0.02 264)",
    "--brand-surface": "oklch(0.97 0.02 264)",
    "--brand-on-surface": "oklch(0.27 0.06 264)",
    "--focus-ring-color": "oklch(0.62 0.21 264)",
    "--font-face": "var(--font-geist-mono), ui-monospace, monospace",
  },
};

function fallback(): ResolvedScope {
  return { slug: FALLBACK_SLUG, tokens: FALLBACK_TOKENS };
}

/**
 * Resolve an arbitrary, untrusted seed into a safe `ResolvedScope`.
 * Total function: every input — `null`, a number, a hostile object, a string with
 * CSS-injection payload — maps to a valid scope. It never throws `[D9]`.
 */
export function resolveScope(seed: unknown): ResolvedScope {
  try {
    if (typeof seed !== "object" || seed === null) return fallback();
    const slug = (seed as { slug?: unknown }).slug;
    if (typeof slug !== "string") return fallback();
    const tokens = PALETTES[slug];
    if (!tokens) return fallback();
    return { slug, tokens };
  } catch {
    // Belt-and-suspenders: the logic above can't throw, but the catch makes the
    // never-throw contract structural rather than a thing a future edit can break.
    return fallback();
  }
}

/**
 * Serialize a resolved scope into the scoped `<style>` body. The engine's scoped block
 * declares `@layer brand` `[D12]` so it slots correctly below `@layer project` (the
 * module's own rules) and above `@layer foundation`.
 */
export function scopedStyleCss(scope: ResolvedScope): string {
  const decls = Object.entries(scope.tokens)
    .map(([prop, value]) => `    ${prop}: ${value};`)
    .join("\n");
  return `@layer brand {\n  [data-project="${scope.slug}"] {\n${decls}\n  }\n}`;
}
