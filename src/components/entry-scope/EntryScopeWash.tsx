import { BRAND_LAYER, hashCss, resolveScope, scopedWashCss } from "./scopeSeed";

interface EntryScopeWashProps {
  /** Untrusted scope seed — same shape/contract as `EntryScope`'s, resolved defensively. */
  seed: unknown;
}

/**
 * The CANVAS template's page-spanning background wash (`kind === "project"` entries whose
 * `Experience` IS the page — see `/[slug]/page.tsx`). A synchronous Server Component sibling
 * to `EntryScope`: the same total, never-throwing `resolveScope` contract and the same React 19
 * hoisted-`<style>` flash-free mechanics (`precedence` + a content-hashed `href`, `@layer
 * brand`) — see `EntryScope`'s doc comment for the mechanism itself.
 *
 * It renders NO markup of its own. Its only job is to hoist the ONE extra rule `scopedWashCss`
 * describes (re-binding `--bg` at `body`, scoped so a copy left behind by Cache Components'
 * `<Activity>`-preserved previous route can't leak onto the next one navigated to — see
 * `scopedWashCss`'s doc comment for the mechanism and the real repro that shaped it).
 * `EntryScope` still owns the bounded per-slot theme and the `[data-entry]` wrapper div this
 * rule's selector keys off; render both together, as siblings, on a canvas route.
 */
export default function EntryScopeWash({ seed }: EntryScopeWashProps) {
  const scope = resolveScope(seed);
  const css = scopedWashCss(scope);
  // Same content-hashed href scheme as `EntryScope` (see its comment): a same-slug re-render
  // with an edited brand gets a new href, so a live-preview edit refreshes the wash instead of
  // keeping a stale first-committed one. A distinct prefix (`entry-wash-`) keeps this style's
  // href from ever colliding with `EntryScope`'s own (`entry-theme-`) for the same scope.
  const href = `entry-wash-${scope.slug}-${hashCss(css)}`;
  return (
    <style href={href} precedence={BRAND_LAYER}>
      {css}
    </style>
  );
}
