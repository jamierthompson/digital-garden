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

// Each themeable role → the semantic token it re-binds + the CSS generic family that TAILS the
// override. The generic keyword is the ONLY fallback appended: never the site palette face (that
// would hardcode the palette this slot must stay decoupled from) and never a self-referential
// `var(--font-<role>)` (a CSS cycle → the whole declaration is dropped). When a role's face is
// absent the override is omitted entirely and the role inherits `:root`.
const ROLE_BINDINGS = [
  { role: "heading", property: "--font-heading", generic: "sans-serif" },
  { role: "body", property: "--font-body", generic: "serif" },
  { role: "mono", property: "--font-mono", generic: "monospace" },
] as const satisfies ReadonlyArray<{
  role: keyof ScopeFaces;
  property: string;
  generic: string;
}>;

/**
 * The entry's bounded font slot. A **synchronous** server component that mounts its subtree
 * under `[data-entry="<slug>"]` wearing the entry's theme typefaces.
 *
 * Color is NOT re-bound here: the page stamps its authored seed on `<html>` (see `PageTheme`),
 * and the slot inherits every color token from it — the page and its slot are one seed. The only
 * per-slot overrides are the fonts, so this maps each RESOLVED role (`--font-heading`/`--font-body`/
 * `--font-mono`) to its roster face as an **inline style** on the wrapper (alongside that face's
 * `.variable` class, which brings `var(<cssVariable>)` into scope). A role whose key was absent or
 * unresolvable emits NO override, so it inherits `:root`'s editorial palette. Inline on a
 * server-rendered div → the value is in the initial shell HTML (flash-free) and is per-element, so
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
  for (const { role, property, generic } of ROLE_BINDINGS) {
    const face = scope.faces[role];
    if (!face) continue;
    style[property] = `var(${face.cssVariable}), ${generic}`;
    classNames.push(face.variable);
  }

  return (
    // A role with no resolved face contributes no class and no override, so when nothing resolves
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
