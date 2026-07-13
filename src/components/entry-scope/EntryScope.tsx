import type { CSSProperties, ReactNode } from "react";

import { resolveScope, type ScopeFaces } from "./scopeSeed";

interface EntryScopeProps {
  /**
   * Untrusted scope seed (e.g. `{ slug, headingFont, bodyFont, monoFont }` from the entry doc).
   * Resolved defensively.
   */
  seed: unknown;
  children: ReactNode;
}

// Each themeable face → the leaf `--font-*` token it re-binds and the CSS generic that TAILS
// that leaf. Which type roles wear which face is NOT known here — that mapping lives solely in
// `semantic/type.css`, whose role bundles are declared at both `:root` and the slot scope and
// re-substitute against these leaves.
//
// The generic keyword is the ONLY fallback appended to the leaf: never the site palette face
// (that would hardcode the palette this slot must stay decoupled from) and never a self-referential
// `var(--font-<face>)` (a CSS cycle → the whole declaration is dropped).
const FACE_BINDINGS = [
  { face: "heading", leaf: "--font-heading", generic: "sans-serif" },
  { face: "body", leaf: "--font-body", generic: "serif" },
  { face: "mono", leaf: "--font-mono", generic: "monospace" },
] as const satisfies ReadonlyArray<{
  face: keyof ScopeFaces;
  leaf: string;
  generic: string;
}>;

/**
 * The entry's bounded font slot. A **synchronous** server component that mounts its subtree
 * under `[data-entry="<slug>"]` wearing the entry's theme typefaces.
 *
 * Color is NOT re-bound here: the page stamps its authored seed on `<html>` (see `PageTheme`),
 * and the slot inherits every color token from it — the page and its slot are one seed. The only
 * per-slot overrides are the fonts. For each RESOLVED face this stamps ONE thing inline on the
 * wrapper: the **leaf** `--font-heading` / `--font-body` / `--font-mono` token (alongside the
 * face's `.variable` class, which brings `var(<cssVariable>)` into scope).
 *
 * The `--type-<role>-family` bundles the typography primitives read are NOT stamped here — the
 * role→face mapping lives solely in `semantic/type.css`, whose bundles are declared at both
 * `:root` and the slot scope. A custom property substitutes its `var()` refs at the element that
 * DECLARES it, so the sheet's slot-scope declarations re-substitute against the leaves stamped
 * on this element; only the per-entry face VALUES vary, and they are all this component emits.
 * Two leaves are ALSO consumed directly at the element level — `--font-heading` by `reset.css`'s
 * `h1–h6` rule, and `--font-mono` by component modules that read `var(--font-mono)`.
 *
 * A face whose key was absent or unresolvable emits NOTHING — not its leaf, not its class — so
 * the sheet's slot-scope bundles resolve against the inherited `:root` leaf and every role mapped
 * to it keeps the editorial face. Inline on a server-rendered div → the values are in the initial
 * shell HTML (flash-free) and per-element, so distinct slots can never collide.
 *
 * Defensive by construction: `resolveScope` never throws — it collapses any bad seed to a safe
 * slug + an empty face set (every role inherits `:root`). It is ALSO wrapped at the route in
 * `unstable_catchError` (see `EntryScopeBoundary`) as the last-resort backstop: `error.tsx` can't
 * catch a layout-level throw, so a component boundary is the correct containment.
 *
 * Synchronous on purpose: it awaits nothing, so it prerenders into the static shell with no
 * `use cache` needed, and stays unit-testable in jsdom (async RSCs do not render there).
 */
export default function EntryScope({ seed, children }: EntryScopeProps) {
  const scope = resolveScope(seed);

  const style: Record<string, string> = {};
  const classNames: string[] = [];
  for (const { face, leaf, generic } of FACE_BINDINGS) {
    const resolved = scope.faces[face];
    if (!resolved) continue;
    style[leaf] = `var(${resolved.cssVariable}), ${generic}`;
    classNames.push(resolved.variable);
  }

  return (
    // A face with no resolved value contributes no class and no override, so when nothing resolves
    // `className` is omitted (no empty class attribute) and the slot inherits `:root` wholesale.
    <div
      data-entry={scope.slug}
      className={classNames.length > 0 ? classNames.join(" ") : undefined}
      style={style as CSSProperties}
    >
      {children}
    </div>
  );
}
