/**
 * True when `value` is a present, non-blank string — not `null`/`undefined`, `""`, or
 * whitespace-only. The predicate behind the media-label guard: an empty or whitespace-only
 * string is a blank accessible name on a `role="img"` (WCAG 2.2 SC 1.1.1), so it counts as
 * absent — both for choosing a label and for deciding whether a caption is real.
 */
export function isNonBlank(value: string | undefined): value is string {
  return value != null && value.trim() !== "";
}

/**
 * First non-blank candidate, or `undefined` if every candidate is blank — the guard against the
 * `value.x ?? "fallback"` footgun, where `??` keeps an empty authored string. Use it instead of
 * chaining `??`/`||` at a call site. A caller that needs a guaranteed string appends its own
 * fallback as the last candidate and coalesces a constant, so even an empty fallback can't leave
 * a blank name.
 */
export function firstNonEmpty(
  candidates: Array<string | undefined>,
): string | undefined {
  return candidates.find(isNonBlank);
}
