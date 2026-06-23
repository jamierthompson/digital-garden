/**
 * Basic author-time *format* validation for brand-colour seed strings.
 *
 * Accepts a CSS hex colour (#rgb / #rgba / #rrggbb / #rrggbbaa) or an
 * `oklch(...)` function. This is intentionally a syntax check only — it does
 * not (yet) confirm the colour can actually hit a contrast target.
 *
 * TODO [D9]: validate via the engine's own colour pipeline (parse -> gamut-map
 * -> confirm in-spec contrast) once the OKLCH engine lands in Phase 1, so
 * editors get real author-time feedback. Until then this is layer 2 of D9's
 * three-layer defence in *format* form only; the engine itself never throws
 * and ProjectScope falls back to a safe palette, so a bad value degrades
 * rather than breaks. [D9]
 */
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const OKLCH = /^oklch\(\s*[^)]+\)$/i

export function isBrandColorString(value: string | undefined): true | string {
  // Empty is allowed here — pair with `.required()` where the field is mandatory.
  if (!value) return true
  if (HEX.test(value.trim()) || OKLCH.test(value.trim())) return true
  return 'Use a hex colour (e.g. #4f46e5) or an oklch() value (e.g. oklch(0.62 0.19 256))'
}
