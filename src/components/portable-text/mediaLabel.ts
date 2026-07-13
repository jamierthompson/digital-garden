/**
 * True when `value` is a present, non-blank string — not `null`/`undefined`, `""`, or
 * whitespace-only. The predicate behind the media-label guard: an empty or whitespace-only
 * string is a blank accessible name on a `role="img"` (WCAG 2.2 SC 1.1.1), so it counts as
 * absent — both for choosing a label and for deciding whether a caption is real.
 *
 * The parameter is `unknown`, not `string | undefined`: block fields are untrusted external data
 * (a raw Content Lake write can drift a `caption`/`alt` to any JSON shape — a number, an object).
 * Narrowing on `typeof` before `.trim()` keeps the guard total, so a drifted non-string counts as
 * blank (absent) rather than throwing `value.trim is not a function` and crashing the article.
 */
export function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * First non-blank candidate, or `undefined` if every candidate is blank — the guard against the
 * `value.x ?? "fallback"` footgun, where `??` keeps an empty authored string. Use it instead of
 * chaining `??`/`||` at a call site. A caller that needs a guaranteed string appends its own
 * fallback as the last candidate and coalesces a constant, so even an empty fallback can't leave
 * a blank name. Candidates are `unknown` (untrusted block data): a wrong-shaped one is simply
 * skipped, never thrown on.
 */
export function firstNonEmpty(candidates: Array<unknown>): string | undefined {
  return candidates.find(isNonBlank);
}
