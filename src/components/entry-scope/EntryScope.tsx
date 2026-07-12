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

// Each themeable face → the leaf `--font-*` token it re-binds, the CSS generic that TAILS that
// leaf, and every `--type-<role>-family` bundle that maps to it. This is the ONE place the
// role→face mapping lives; `:root` in `type.css` declares the same mapping as the site default.
//
// The generic keyword is the ONLY fallback appended to the leaf: never the site palette face
// (that would hardcode the palette this slot must stay decoupled from) and never a self-referential
// `var(--font-<face>)` (a CSS cycle → the whole declaration is dropped). A role bundle's value is
// `var(--font-<face>)`, referencing the leaf co-declared on this same element — so the generic
// fallback stays declared once, on the leaf.
const FACE_BINDINGS = [
  {
    face: "heading",
    leaf: "--font-heading",
    generic: "sans-serif",
    roles: ["display", "title", "heading", "subheading", "label"],
  },
  {
    face: "body",
    leaf: "--font-body",
    generic: "serif",
    roles: ["lead", "body"],
  },
  {
    face: "mono",
    leaf: "--font-mono",
    generic: "monospace",
    roles: ["meta"],
  },
] as const satisfies ReadonlyArray<{
  face: keyof ScopeFaces;
  leaf: string;
  generic: string;
  roles: ReadonlyArray<string>;
}>;

/**
 * The entry's bounded font slot. A **synchronous** server component that mounts its subtree
 * under `[data-entry="<slug>"]` wearing the entry's theme typefaces.
 *
 * Color is NOT re-bound here: the page stamps its authored seed on `<html>` (see `PageTheme`),
 * and the slot inherits every color token from it — the page and its slot are one seed. The only
 * per-slot overrides are the fonts. For each RESOLVED face this stamps TWO channels of solved
 * values inline on the wrapper (alongside the face's `.variable` class, which brings
 * `var(<cssVariable>)` into scope):
 *
 *   1. The **leaf** `--font-heading|body|mono` token, read by the element-level rules in
 *      `reset.css` (the `[data-entry]` body baseline, `h1–h6`, mono/code) that substitute at
 *      their own element.
 *   2. Every **`--type-<role>-family` bundle** mapped to that face, read by the typography
 *      primitives (`Heading`/`Text`). The value is `var(--font-<face>)`, resolving against the
 *      leaf co-declared on this same element.
 *
 * Both channels carry solved values from TS — there is NO CSS re-derivation. `:root` in `type.css`
 * declares the site-default role→face mapping; this slot restates the theme's faces onto the same
 * two channels so both element rules and primitives wear the entry's face. (A custom property
 * substitutes its `var()` refs at the element that DECLARES it, so a `:root`-only `--type-*-family`
 * binding freezes to the site face there and a `[data-entry]` `--font-*` override never re-enters
 * it — restamping the bundle here is what lets the primitive see the slot's face.)
 *
 * A face whose key was absent or unresolvable emits NOTHING — not its leaf, not its role bundles,
 * not its class — so every role mapped to it inherits `:root`'s editorial face. Inline on a
 * server-rendered div → the values are in the initial shell HTML (flash-free) and per-element, so
 * distinct slots can never collide.
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
  for (const { face, leaf, generic, roles } of FACE_BINDINGS) {
    const resolved = scope.faces[face];
    if (!resolved) continue;
    style[leaf] = `var(${resolved.cssVariable}), ${generic}`;
    classNames.push(resolved.variable);
    for (const role of roles) {
      style[`--type-${role}-family`] = `var(${leaf})`;
    }
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
