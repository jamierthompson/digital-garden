import { createClient } from "next-sanity";

import { apiVersion, dataset, projectId } from "./env";

/**
 * Fields whose string values are consumed by CODE, not rendered as prose, so
 * they must never carry stega's invisible zero-width chars. [D16]
 *
 * - `brandColor` / `brandColorDark` are parsed by the OKLCH engine; stega
 *   chars break the colour parse.
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

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  stega: {
    // Off until Phase 3 enables draft mode / Presentation, which toggles stega
    // on per-request for the preview perspective. The filter below is honoured
    // whenever stega is enabled.
    enabled: false,
    filter: (props) => {
      const field = props.sourcePath.at(-1);
      if (typeof field === "string" && STEGA_EXCLUDED_FIELDS.has(field)) {
        return false;
      }
      return props.filterDefault(props);
    },
  },
});
