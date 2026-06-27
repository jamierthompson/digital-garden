// The `first-light` project-local embed manifest (§4.1, [D15, D24]).
//
// This does NOT re-implement resolution — the actual `embedKey → loader` map lives in the
// shared `src/lib/resolvers/embeds.ts` (a project-local resolver tier is added only on a
// GENUINE second use [D24, §4.1]). It is a typed declaration of which embed keys THIS
// essay references, so a stray key can be spotted against an explicit list.
//
// `satisfies readonly EmbedKey[]` ties each entry to a key that exists in `keys.ts` — a
// typo is a compile error here, not a silent missing-embed placeholder at render time [D10].

import type { EmbedKey } from "@/lib/keys";

/** Embed keys the `first-light` essay embeds, by `liveEmbed` block. */
export const FIRST_LIGHT_EMBED_KEYS = [
  "sunrise-meter",
] as const satisfies readonly EmbedKey[];
