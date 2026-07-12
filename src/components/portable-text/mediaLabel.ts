/**
 * First non-empty candidate, else the fallback — the guard against the
 * `value.x ?? "fallback"` footgun.
 *
 * `??` only treats `null` / `undefined` as absent, so an empty (or whitespace-only) authored
 * string slips through and lands as a blank accessible name on a `role="img"` placeholder
 * (WCAG 2.2 SC 1.1.1). This treats `""` and whitespace-only as absent, so a media label built
 * from optional Sanity strings is always a real, non-blank name. Use it instead of chaining
 * `??`/`||` at the call site.
 */
export function firstNonEmpty(
  candidates: Array<string | undefined>,
  fallback: string,
): string {
  return candidates.find((c) => c != null && c.trim() !== "") ?? fallback;
}
