import type { CSSProperties, ReactNode } from "react";

import { FONT_STACK, resolveScope } from "./scopeSeed";

interface EntryScopeProps {
  /** Untrusted scope seed (e.g. `{ slug, fontKey }` from the entry doc). Resolved defensively. */
  seed: unknown;
  children: ReactNode;
}

/**
 * The entry's bounded font slot. A **synchronous** server component that mounts its subtree
 * under `[data-entry="<slug>"]` wearing the entry's theme typeface.
 *
 * Color is NOT re-bound here: the page stamps its authored seed on `<html>` (see `PageTheme`),
 * and the slot inherits every color token from it — the page and its slot are one seed. The only
 * per-slot override is the font, so this maps `--font-body` to the resolved roster face as an
 * **inline style** on the wrapper (alongside that face's `.variable` class, which brings
 * `var(<cssVariable>)` into scope). Inline on a server-rendered div → the value is in the initial
 * shell HTML (flash-free) and is per-element, so distinct slots can never collide.
 *
 * Defensive by construction: `resolveScope` never throws — it collapses any bad seed to a safe
 * slug + the shell mono face. It is ALSO wrapped at the route in `unstable_catchError` (see
 * `EntryScopeBoundary`) as the last-resort backstop: `error.tsx` can't catch a layout-level
 * throw, so a component boundary is the correct containment.
 *
 * Synchronous on purpose: it awaits nothing, so it prerenders into the static shell with no
 * `use cache` needed, and stays unit-testable in jsdom (async RSCs do not render there).
 */
export default function EntryScope({ seed, children }: EntryScopeProps) {
  const scope = resolveScope(seed);
  const style = {
    "--font-body": `var(${scope.font.cssVariable}), ${FONT_STACK}`,
  } as CSSProperties;
  return (
    // Shell-mono fallback has no roster class (its variable is already on `<html>`), so
    // `className` is omitted to avoid an empty class attribute.
    <div
      data-entry={scope.slug}
      className={scope.font.variable || undefined}
      style={style}
    >
      {children}
    </div>
  );
}
