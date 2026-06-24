// The `first-light` project-local embed manifest (§4.1, [D15, D24]).
//
// The embed REGISTRY stays single-tier for now: the actual `embedKey → loader` map lives
// in the shared `src/lib/resolvers/embeds.ts`, and a project-local resolver tier is added
// only on a GENUINE second use (a second project reusing a widget) [D24, §4.1]. So this
// file does NOT re-implement resolution — it is a typed declaration of which embed keys
// THIS project's essay references, so the module is self-documenting and a stray key in
// the essay can be spotted against an explicit list.
//
// `satisfies readonly EmbedKey[]` ties each entry to a key that actually exists in
// `keys.ts` — a typo or a dropped key is a compile error here, not a silent missing-embed
// placeholder at render time (the placeholder is the content→code drift backstop, not a
// license to misdeclare in code) [D10].

import type { EmbedKey } from "@/lib/keys";

/** Embed keys the `first-light` essay embeds, by `liveEmbed` block. */
export const FIRST_LIGHT_EMBED_KEYS = [
  "sunrise-meter",
] as const satisfies readonly EmbedKey[];
