// Fails if any CSS under `src/` MUTATES a semantic COLOR token. Three forbidden forms, all the
// same sin — deriving a new color from a SOLVED one:
//   1. color-mix()   — `color-mix(… var(--token) …)`
//   2. slash-alpha   — `var(--token) / <alpha>`
//   3. relative color — `<oklch|oklab|lab|lch|rgb|hsl|hwb|color>(from var(--token) …)`
// Color tokens are engine-derived/authored SOLVED values (contrast-solved against a mapped
// background per scheme). Mixing one toward transparent, dropping its alpha, or re-deriving it
// through relative-color syntax silently breaks the very contrast it was solved for — the fix is a
// designed token (`--muted-foreground`, `--accent-subtle`, …), not a mutation; derivation belongs
// in the OKLCH engine, not component CSS.
//
// The color-token name set is derived from the `--name:` declarations in
// `src/styles/semantic/color.css` — that file IS the semantic color contract. So any of the three
// forms on a NON-color var (`--space-*`, `--radius-*`, a border WIDTH) or on `currentColor` is
// exempt: it isn't a solved color token.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import postcss from "postcss";

const SRC = new URL("../src", import.meta.url).pathname;
const COLOR_CONTRACT = new URL(
  "../src/styles/semantic/color.css",
  import.meta.url,
).pathname;

// Parse the `--name:` custom-property DECLARATIONS from the semantic color contract into the set
// of color-token names. Comments are stripped first so a commented-out declaration never counts.
export function parseColorTokenNames(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const names = new Set();
  for (const m of noComments.matchAll(/(--[a-z0-9-]+)\s*:\s*[^;]+;/gi)) {
    names.add(m[1]);
  }
  return names;
}

// Slice out each balanced `color-mix( … )` call from a declaration value (handles nested
// parens — `var()`, `oklch()` inside the mix). Returns `{ text, start, end }` index ranges so a
// relative-color match sitting INSIDE a mix (already flagged) can be skipped, not double-counted.
function colorMixCalls(value) {
  const calls = [];
  const re = /color-mix\s*\(/gi;
  let m;
  while ((m = re.exec(value))) {
    let depth = 0;
    let end = m.index;
    for (let i = m.index + m[0].length - 1; i < value.length; i++) {
      if (value[i] === "(") depth++;
      else if (value[i] === ")" && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    calls.push({ text: value.slice(m.index, end), start: m.index, end });
    re.lastIndex = end;
  }
  return calls;
}

const VAR_REF = /var\(\s*(--[a-z0-9-]+)/gi;
// A color-token var immediately followed by slash-alpha: `var(--foreground) / 50%`. The closing
// `)` of the var() is required so `var(--ring, currentColor)` (comma fallback, no trailing slash)
// never matches.
const SLASH_ALPHA = /var\(\s*(--[a-z0-9-]+)\s*\)\s*\/\s*[^,)]+/gi;
// Relative-color syntax deriving from a token: `oklch(from var(--accent) l c h / 0.05)`. The
// `from var(--token)` head is the tell — the channel keywords and any `/ alpha` follow. `color-mix`
// can't match here (`color-mix(` has a hyphen, not `color(`); its nested relative colors are
// handled by the mix range skip below).
const REL_COLOR =
  /\b(?:oklch|oklab|lab|lch|rgba?|hsla?|hwb|color)\(\s*from\s+var\(\s*(--[a-z0-9-]+)/gi;

// PURE detector: given a declaration value and the color-token set, return the mutations found.
// Each mutation is `{ kind: "color-mix" | "slash-alpha" | "relative-color", token }`.
export function detectMutations(value, colorTokens) {
  const found = [];
  const mixRanges = [];
  for (const { text, start, end } of colorMixCalls(value)) {
    mixRanges.push([start, end]);
    for (const m of text.matchAll(VAR_REF)) {
      if (colorTokens.has(m[1])) {
        found.push({ kind: "color-mix", token: m[1] });
        break; // one violation per color-mix call
      }
    }
  }
  const insideMix = (i) => mixRanges.some(([s, e]) => i >= s && i < e);
  for (const m of value.matchAll(SLASH_ALPHA)) {
    if (colorTokens.has(m[1])) {
      found.push({ kind: "slash-alpha", token: m[1] });
    }
  }
  for (const m of value.matchAll(REL_COLOR)) {
    // Skip a relative color nested in a color-mix — that mix already counts as one violation.
    if (colorTokens.has(m[1]) && !insideMix(m.index)) {
      found.push({ kind: "relative-color", token: m[1] });
    }
  }
  return found;
}

// Scan a CSS source string, returning `{ line, kind, token }` for every mutation across all
// declarations (postcss gives accurate declaration line numbers and skips comments/at-rules).
export function findColorMutations(css, colorTokens, from) {
  const root = postcss.parse(css, from ? { from } : undefined);
  const violations = [];
  root.walkDecls((decl) => {
    for (const { kind, token } of detectMutations(decl.value, colorTokens)) {
      violations.push({ line: decl.source.start.line, kind, token });
    }
  });
  return violations;
}

function findCss(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findCss(full));
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

function main() {
  const colorTokens = parseColorTokenNames(
    readFileSync(COLOR_CONTRACT, "utf8"),
  );
  const violations = [];
  for (const file of findCss(SRC)) {
    for (const v of findColorMutations(
      readFileSync(file, "utf8"),
      colorTokens,
      file,
    )) {
      const how = {
        "color-mix": `color-mix() on var(${v.token})`,
        "slash-alpha": `slash-alpha on var(${v.token})`,
        "relative-color": `relative-color from var(${v.token})`,
      }[v.kind];
      violations.push(`${relative(process.cwd(), file)}:${v.line}  ${how}`);
    }
  }

  if (violations.length) {
    console.error("CSS mutating a solved semantic color token:\n");
    for (const v of violations) console.error(`  ${v}`);
    console.error(
      `\n${violations.length} violation(s). Color tokens are solved values — read a designed ` +
        `token (e.g. --muted-foreground, --accent-subtle) instead of mixing/fading one.`,
    );
    process.exit(1);
  }
  console.log(
    "CSS: no solved color token is mutated (color-mix / slash-alpha / relative-color).",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
