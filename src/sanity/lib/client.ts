import { createClient } from "next-sanity";

import { apiVersion, dataset, projectId } from "./env";

/**
 * Fields whose string values are consumed by CODE, not rendered as prose, so
 * they must never carry stega's invisible zero-width chars. [D16]
 *
 * - `brandColor` / `brandColorDark` are parsed by the OKLCH engine; stega
 *   chars break the color parse.
 * - `fontKey` / `componentKey` / `embedKey` are resolved against code by key;
 *   stega chars break the lookup (and reintroduce key-drift).
 *
 * Sanity's default stega denylist skips `color`/`hex`/slugs but NOT these
 * field names, so we exclude them explicitly. Visual editing (and thus stega)
 * is wired up at Phase 3; this filter ships now so the exclusion travels with
 * the client the moment stega is enabled per-request.
 */
const STEGA_EXCLUDED_FIELDS = new Set([
  "brandColor",
  "brandColorDark",
  "fontKey",
  "componentKey",
  "embedKey",
]);

/**
 * Where the standalone Studio lives, for Visual Editing click-to-edit deep links.
 *
 * `@sanity/client` v7 *requires* `stega.studioUrl` whenever `stega.enabled` is
 * true (it throws "stega.studioUrl must be defined" at client construction
 * otherwise), because the encoded source-map strings carry a link back to the
 * Studio document. This Studio is a SEPARATE workspace/deployment (`studio/`),
 * not an embedded `/studio` route, so the link target is its own origin —
 * overridable per environment via the public `NEXT_PUBLIC_SANITY_STUDIO_URL` var,
 * defaulting to a local `/studio` path for dev. It is public (it ships in encoded
 * preview strings), so the `NEXT_PUBLIC_` prefix is correct here. [security-and-ops §1]
 */
const studioUrl = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || "/studio";

/**
 * `true` when the path's leaf field is one of the code-consumed fields above and
 * must therefore NOT carry stega chars. Pulled out of the inline filter so BOTH
 * clients apply the identical exclusion: the filter has to travel with whichever
 * client is stega-enabled per request, and a single source keeps them in lockstep.
 */
function isStegaExcludedField(sourcePath: readonly unknown[]): boolean {
  const field = sourcePath.at(-1);
  return typeof field === "string" && STEGA_EXCLUDED_FIELDS.has(field);
}

/**
 * The PUBLIC client — published content only, fully cacheable.
 *
 * `useCdn: true` serves from Sanity's CDN (published docs, no token). Stega is
 * `enabled: false`: this client never carries the draft token and never powers
 * Visual Editing, so it must emit clean strings. This is the default read path
 * for every public render. [security-and-ops §3]
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published",
  stega: {
    enabled: false,
    filter: (props) =>
      isStegaExcludedField(props.sourcePath)
        ? false
        : props.filterDefault(props),
  },
});

/**
 * The DRAFT client — drafts + published, for Draft Mode / Presentation only. [D16]
 *
 * Distinct from the public client on three axes:
 * - `useCdn: false` — the CDN only knows published docs and lags edits; draft
 *   preview must hit the live API so authors see their unpublished changes.
 * - `perspective: "drafts"` — overlays draft documents on top of published ones.
 *   NOTE: the build brief / older `next-sanity` docs name this `"previewDrafts"`,
 *   but in `@sanity/client` v7 that spelling is `DeprecatedPreviewDrafts`; the
 *   current, non-deprecated identifier for the same behaviour is `"drafts"`. Same
 *   [D16] intent, current name — flagged here so the rename is visible, not silent.
 * - `stega: enabled: true` — Visual Editing needs the steganographic source-map
 *   chars to drive click-to-edit, with the exclusion above keeping the
 *   code-consumed fields (`brandColor`/`fontKey`/…) clean for the OKLCH parse +
 *   key lookups. [D16]
 *
 * The drafts-capable TOKEN is NOT baked in here — it's a server-only secret
 * (`SANITY_API_READ_TOKEN`) attached per request via `.withConfig({ token })` in
 * the draft-mode route handler, so the token never travels with a module-level
 * export that could be pulled into a client bundle. [security-and-ops §3]
 */
export const draftClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  perspective: "drafts",
  stega: {
    enabled: true,
    studioUrl,
    filter: (props) =>
      isStegaExcludedField(props.sourcePath)
        ? false
        : props.filterDefault(props),
  },
});
