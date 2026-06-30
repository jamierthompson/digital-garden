// fontKey resolver. Resolves a Sanity `fontKey` to its roster
// face, returning a typed `NotFound` for an unknown key rather than throwing.

import { FONT_FACES, type FontFace } from "@/fonts/roster";
import { isFontKey } from "@/lib/keys";

import { found, notFound, type Resolution } from "./resolution";

/**
 * Resolve a `fontKey` (an arbitrary string from Sanity) to its roster face.
 * Returns `NotFound` when the key is not in `FONT_KEYS` — the caller
 * (`ProjectScope`) falls back to the shell font on a miss.
 */
export function resolveFontKey(key: string): Resolution<FontFace> {
  return isFontKey(key) ? found(FONT_FACES[key]) : notFound("font", key);
}
