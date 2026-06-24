/**
 * Escape the five XML predefined entities so authored text (project titles,
 * blurbs) can't break the feed document or inject markup. Applied to every
 * interpolated string in the RSS route. Kept in its own module — not in
 * `route.ts` — so it can be unit-tested without exporting a non-handler from a
 * Route Handler file (Next only allows HTTP-method/config exports there).
 *
 * Order matters: `&` must be replaced first, otherwise it would double-escape the
 * ampersands introduced by the later replacements.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
