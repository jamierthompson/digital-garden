import type { StegaConfig } from "@sanity/client/stega";

/**
 * The single source of truth for stega (Content Source Map) field-exclusions.
 *
 * Both the published `client` (`./client.ts`) and the Live Content base client
 * (`./live.ts`, passed to `defineLive`) import the exclusion filter from here, so
 * the code-consumed-field denylist can never drift between them — the whole point
 * of single-sourcing it here. `defineLive` flips stega `enabled` per request (off for published,
 * on for drafts), but the *filter* and *studioUrl* it carries come from whichever
 * client it was given, so they must be identical wherever stega can switch on.
 */

/**
 * Fields whose string values are consumed by CODE, not rendered as prose, so they
 * must never carry stega's invisible zero-width characters.
 *
 * - `componentKey` / `slotKey` are resolved against code by key; stega chars break the
 *   lookup (and reintroduce key-drift).
 * - `kind` / `stage` are discriminators compared in code (`entry.kind === "project"`
 *   gates the module mount and the browse sections; `stage` feeds a `data-stage`
 *   CSS attribute selector). Stega chars make every comparison false — in Draft Mode
 *   that silently degraded a project entry to prose-only and emptied the browse
 *   sections (found via #131's mounted-draft review).
 *
 * The entry's `theme` object is excluded by ANCESTOR instead (see below) — its leaf names
 * (`color` / `headingFont` / `bodyFont` / `monoFont`) are common words that must NOT be
 * denylisted globally.
 *
 * Sanity's default stega denylist skips `color`/`hex`/slugs but NOT these field
 * names, so we exclude them explicitly.
 */
export const STEGA_EXCLUDED_FIELDS = new Set([
  "componentKey",
  "slotKey",
  "kind",
  "stage",
]);

/**
 * Ancestor objects whose every nested field is a code-consumed seed, excluded by ANCESTOR
 * because their leaf names are common words we must NOT denylist globally:
 *
 * - `theme` — the entry's `{ color, colorDark, headingFont, bodyFont, monoFont }`: `color`/`colorDark`
 *   are parsed by the OKLCH engine, the three font faces are resolved against the font roster by key;
 *   both break on stega chars.
 * - `pageThemes` — `siteSettings`'s per-page seeds (`home` / `browse` / `about` / `now` / `system`),
 *   theme colors parsed by the OKLCH engine (#166), sharing the same hazard.
 */
const STEGA_EXCLUDED_ANCESTORS = new Set(["theme", "pageThemes"]);

/**
 * Where the standalone Studio lives, for Visual Editing click-to-edit deep links.
 *
 * `@sanity/client` v7 *requires* `stega.studioUrl` whenever stega is enabled (it
 * throws "stega.studioUrl must be defined" otherwise), because the encoded
 * source-map strings carry a link back to the Studio document. This Studio is a
 * SEPARATE workspace/deployment (`studio/`), not an embedded `/studio` route, so the
 * link target is its own origin — overridable per environment via the public
 * `NEXT_PUBLIC_SANITY_STUDIO_URL` var, defaulting to a local `/studio` path for dev.
 * It is public (it ships in encoded preview strings), so the `NEXT_PUBLIC_` prefix is
 * correct here. (see security-and-ops.md)
 */
export const studioUrl = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || "/studio";

/**
 * `true` when the path's leaf field is a code-consumed field by name, OR the path passes
 * through a code-consumed ancestor object (e.g. `siteSettings.pageThemes.now`).
 */
export function isStegaExcludedField(sourcePath: readonly unknown[]): boolean {
  const field = sourcePath.at(-1);
  if (typeof field === "string" && STEGA_EXCLUDED_FIELDS.has(field))
    return true;
  return sourcePath.some(
    (segment) =>
      typeof segment === "string" && STEGA_EXCLUDED_ANCESTORS.has(segment),
  );
}

/**
 * The stega `filter` both stega-capable clients install: skip the code-consumed
 * fields, defer to Sanity's default denylist for everything else. Typed from the
 * client's own `StegaConfig["filter"]` so it stays in lockstep with the library.
 */
export const stegaFilter: NonNullable<StegaConfig["filter"]> = (props) =>
  isStegaExcludedField(props.sourcePath) ? false : props.filterDefault(props);
