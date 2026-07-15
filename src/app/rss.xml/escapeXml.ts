/**
 * Characters stripped before escaping, in two groups:
 *   1. Illegal in XML 1.0 — no entity can rescue them, and one anywhere in the
 *      document makes a conformant parser reject the whole feed: the C0 controls
 *      except tab/LF/CR, lone surrogates (a valid pair, e.g. an emoji, survives),
 *      and the U+FFFE/U+FFFF noncharacters. These are the gaps in the Char
 *      production (https://www.w3.org/TR/xml/#charsets).
 *   2. Legal but on XML 1.1's restricted-character list
 *      (https://www.w3.org/TR/xml11/#charsets) and never legitimately authored —
 *      DEL and the C1 controls (U+007F–U+009F). Stripped as deliberate hardening
 *      so the feed carries no control-character mojibake.
 * Both groups are reachable via a raw Content Lake write even though the Studio
 * can't type them. Legal noncharacters that are not controls (U+FDD0–FDEF, the
 * plane-end noncharacters, U+FFFD) are kept.
 */
const XML_UNSAFE_CHARS =
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Escape the five XML predefined entities so authored text (entry titles,
 * summaries) can't break the feed document or inject markup. Applied to every
 * interpolated string in the RSS route. Kept in its own module — not in
 * `route.ts` — so it can be unit-tested without exporting a non-handler from a
 * Route Handler file (Next only allows HTTP-method/config exports there).
 *
 * Order matters: unsafe characters are stripped first, then `&` is replaced
 * before the other entities, otherwise it would double-escape the ampersands
 * introduced by the later replacements.
 */
export function escapeXml(value: string): string {
  return value
    .replace(XML_UNSAFE_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
