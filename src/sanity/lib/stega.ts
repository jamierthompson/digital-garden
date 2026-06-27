import type { StegaConfig } from "@sanity/client/stega";

/**
 * The SINGLE source for stega (Content Source Map) configuration. [D16]
 *
 * Both the published `client` (`./client.ts`) and the Live Content base client
 * (`./live.ts`, passed to `defineLive`) import the exclusion filter from here, so
 * the code-consumed-field denylist can never drift between them — the whole point
 * of [D16]. `defineLive` flips stega `enabled` per request (off for published,
 * on for drafts), but the *filter* and *studioUrl* it carries come from whichever
 * client it was given, so they must be identical wherever stega can switch on.
 */

/**
 * Fields whose string values are consumed by CODE, not rendered as prose, so they
 * must never carry stega's invisible zero-width characters. [D16]
 *
 * - `brandColor` / `brandColorDark` are parsed by the OKLCH engine; stega chars
 *   break the color parse.
 * - `fontKey` / `componentKey` / `embedKey` are resolved against code by key; stega
 *   chars break the lookup (and reintroduce key-drift).
 *
 * Sanity's default stega denylist skips `color`/`hex`/slugs but NOT these field
 * names, so we exclude them explicitly.
 */
export const STEGA_EXCLUDED_FIELDS = new Set([
  "brandColor",
  "brandColorDark",
  "fontKey",
  "componentKey",
  "embedKey",
]);

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
 * correct here. [security-and-ops §1]
 */
export const studioUrl = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || "/studio";

/** `true` when the path's leaf field is one of the code-consumed fields above. */
export function isStegaExcludedField(sourcePath: readonly unknown[]): boolean {
  const field = sourcePath.at(-1);
  return typeof field === "string" && STEGA_EXCLUDED_FIELDS.has(field);
}

/**
 * The stega `filter` both stega-capable clients install: skip the code-consumed
 * fields, defer to Sanity's default denylist for everything else. Typed from the
 * client's own `StegaConfig["filter"]` so it stays in lockstep with the library.
 */
export const stegaFilter: NonNullable<StegaConfig["filter"]> = (props) =>
  isStegaExcludedField(props.sourcePath) ? false : props.filterDefault(props);
