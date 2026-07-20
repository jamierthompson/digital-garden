// Fails if a component CSS Module paints a non-text GRAPHIC from a text-tier color token.
//
// WCAG 2.2 SC 1.4.11 (Non-text Contrast, https://www.w3.org/TR/WCAG22/#non-text-contrast) governs
// icons, marks and glyphs that convey meaning or indicate a UI state at 3:1 — the engine's `ui`
// tier. (A purely decorative mark has no floor under the SC; solving every glyph at `ui` is this
// project's quality bar, set one notch above the standard.) The text roles are solved at 4.5
// because they are for TEXT; a graphic reading one is the wrong role, not merely extra contrast.
//
// The neutral graphic ink is `--icon`. `--foreground` is ALLOWED: same neutral ramp at full
// strength, so moving between them is an emphasis change within one role — how a glyph's hover
// reads. `--muted-foreground` is NOT: its job is secondary *text*, and a graphic's de-emphasis is
// `--icon` itself. A graphic may also wear a FILL (`--accent`, `--accent-hover`, a status fill) or
// an on-fill label (`--accent-foreground`, `--<status>-foreground`) when it sits ON that fill.
//
// WHAT COUNTS AS A GRAPHIC PAINT SITE — two signals, because neither alone is enough:
//
//   1. The selector's SUBJECT is an `svg` or carries a class whose name tokenizes to
//      icon/mark/glyph/logo. Subject-scoped so `.logo + .caption` reads as the caption it
//      targets; token-matched so `.markdown` and `.logout` stay prose.
//
//   2. The module declares a graphic rule anywhere, and the declaration is `color`. `color`
//      inherits, so an SVG painting `currentColor` takes its ink from an ancestor — commonly the
//      control rather than the glyph, which signal 1 cannot see. A module is one component's
//      stylesheet, so a `color` in it can reach a graphic in it.
//
// Signal 2 is deliberately over-inclusive: a module mixing prose and glyphs may see a text rule
// flagged. That is the safe direction — the fix is to state each part's ink explicitly.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import postcss from "postcss";

import { parseColorTokenNames } from "./check-color-immutability.mjs";

const SRC = new URL("../src", import.meta.url).pathname;

const GRAPHIC_WORDS = new Set(["icon", "mark", "glyph", "logo"]);

// The text tier — solved at 4.5 for TEXT. Derived from the baked semantic contract
// (`src/styles/semantic/color.css` — the same source `check-color-immutability` reads), so a
// new text role is guarded the moment the bake regenerates instead of waiting on a hand
// edit here (QA-334 D1: a hardcoded list missed the seven `harmony-<hue>-text` roles). Every
// engine `*-text` name is the 4.5-solved text tier by construction; `muted-foreground` is the
// one text role without the suffix. `--foreground` is deliberately absent (see above).
const COLOR_CONTRACT = join(process.cwd(), "src/styles/semantic/color.css");
const textRoles = [
  ...parseColorTokenNames(readFileSync(COLOR_CONTRACT, "utf8")),
]
  .map((name) => name.slice(2))
  .filter((name) => name.endsWith("-text"));
const TEXT_TIER = new RegExp(
  `var\\(\\s*--(muted-foreground|${textRoles.join("|")})\\s*[,)]`,
  "i",
);

// `color` is the inheritance channel an SVG's `currentColor` reads; `fill`/`stroke` paint one
// directly.
const PAINT_PROPS = new Set(["color", "fill", "stroke"]);
const INHERITED_PAINT_PROP = "color";

const strip = (value) => value.replace(/\/\*[\s\S]*?\*\//g, " ");

/** Split a class name into words across kebab-case and camelCase: `logoMark` → [logo, mark]. */
function classWords(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[-_\s]+/)
    .map((word) => word.toLowerCase())
    .filter(Boolean);
}

/**
 * The SUBJECT of a selector — the rightmost compound, i.e. the element the rule actually styles.
 * `:has()` and `:not()` describe OTHER elements (a relational check and a negation), so their
 * arguments are removed before the subject is read; `:is()`/`:where()` do describe the subject
 * and are kept.
 */
function subjectOf(selector) {
  const withoutRelational = selector.replace(
    /:(has|not)\(([^()]|\([^()]*\))*\)/gi,
    " ",
  );
  const compounds = withoutRelational.split(/\s*[\s>+~]\s*/).filter(Boolean);
  return compounds[compounds.length - 1] ?? "";
}

/** Does this selector's subject name a non-text graphic? */
function subjectIsGraphic(selector) {
  for (const part of selector.split(",")) {
    const subject = subjectOf(part.trim());
    if (!subject) continue;
    // A bare `svg` type selector in the subject compound.
    if (/(^|[^\w-])svg\b/i.test(subject.replace(/\.[\w-]+/g, " "))) return true;
    for (const [, className] of subject.matchAll(/\.([\w-]+)/g)) {
      if (classWords(className).some((word) => GRAPHIC_WORDS.has(word))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Resolve a paint value through locally-declared component tokens.
 *
 * `--logo-ink: var(--muted-foreground); color: var(--logo-ink)` is the SAME violation as reading
 * the text role inline — the indirection is a naming step, not a semantic one. Bounded by the
 * seen-set, so a cyclic declaration terminates instead of hanging.
 */
function resolveValue(value, tokens, seen = new Set()) {
  let resolved = strip(value);
  // `\w` admits the underscore, which is valid in a <custom-property-name>: a `--icon_ink` alias
  // must not slip past just because the repo's convention is kebab-case.
  for (const [, name] of resolved.matchAll(/var\(\s*(--[\w-]+)/gi)) {
    if (seen.has(name) || !(name in tokens)) continue;
    seen.add(name);
    resolved += " " + resolveValue(tokens[name], tokens, seen);
  }
  return resolved;
}

/** PURE detector: violations in one CSS source. */
export function findIconRoleViolations(css, { from } = {}) {
  const root = postcss.parse(css, from ? { from } : undefined);

  const tokens = {};
  let moduleHasGraphic = false;
  root.walkDecls((decl) => {
    if (decl.prop.startsWith("--")) tokens[decl.prop] = decl.value;
  });
  root.walkRules((rule) => {
    if (subjectIsGraphic(rule.selector)) moduleHasGraphic = true;
  });

  const violations = [];
  root.walkRules((rule) => {
    const graphicRule = subjectIsGraphic(rule.selector);
    rule.walkDecls((decl) => {
      // Declaring a token is not painting with it — caught at the paint site, post-resolution.
      if (decl.prop.startsWith("--")) return;
      const prop = decl.prop.toLowerCase();
      if (!PAINT_PROPS.has(prop)) return;
      const isPaintSite =
        graphicRule || (moduleHasGraphic && prop === INHERITED_PAINT_PROP);
      if (!isPaintSite) return;
      if (TEXT_TIER.test(resolveValue(decl.value, tokens))) {
        violations.push({
          line: decl.source.start.line,
          selector: rule.selector,
          prop: decl.prop,
          value: decl.value,
        });
      }
    });
  });
  return violations;
}

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(full);
    return entry.name.endsWith(".module.css") ? [full] : [];
  });
}

export function main() {
  const violations = [];
  for (const file of cssFiles(SRC)) {
    const rel = relative(join(SRC, ".."), file);
    for (const v of findIconRoleViolations(readFileSync(file, "utf8"), {
      from: file,
    })) {
      violations.push(
        `${rel}:${v.line}  ${v.selector} { ${v.prop}: ${v.value} }`,
      );
    }
  }

  if (violations.length) {
    console.error("Graphic painted from a TEXT-tier color token:\n");
    for (const v of violations) console.error(`  ${v}`);
    console.error(
      `\n${violations.length} violation(s). Icons, marks and glyphs are non-text content — ` +
        `WCAG 2.2 SC 1.4.11 governs them at 3:1, the engine's \`ui\` tier. Paint them from ` +
        `--icon (the neutral graphic ink), --foreground for full strength, or a fill they sit on ` +
        `(--accent, --accent-hover, a status fill and its --*-foreground label). The --*-text ` +
        `roles are solved at 4.5 for TEXT.\n\nNote: \`color\` is checked on EVERY rule in a module ` +
        `that contains a graphic, because \`color\` inherits and an SVG painting \`currentColor\` ` +
        `takes its ink from an ancestor. If a flagged rule really is text that no glyph inherits ` +
        `from, give the glyph its own explicit ink so the two are stated separately.`,
    );
    process.exit(1);
  }
  console.log(
    "CSS: no component module paints a graphic from a text-tier color token.",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
