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
// WHAT COUNTS AS A GRAPHIC PAINT SITE — two independent signals, because neither alone is enough:
//
//   1. The selector's SUBJECT (its rightmost compound) is an `svg` element or carries a class
//      whose NAME tokenizes to icon/mark/glyph/logo. Subject-scoped so `.logo + .caption` is read
//      as the caption it targets; token-matched so `.markdown` and `.logout` stay prose.
//
//   2. The module declares a graphic rule ANYWHERE, and the declaration is `color`. `color`
//      inherits, and an SVG painting `currentColor` takes its ink from whatever ancestor set it —
//      which in this repo's own convention is the CONTROL, not the glyph (`SchemeToggle`: the ink
//      is on `.toggle`, `.icon` carries only geometry). Signal 1 cannot see that: `.toggle` names
//      no graphic. A module is one component's stylesheet, so if a graphic lives in it, any
//      `color` in it can reach that graphic.
//
// Signal 2 is deliberately over-inclusive: a module mixing prose and glyphs may see a text rule
// flagged. That is the safe direction — the failure is loud and the fix is to say explicitly
// which ink each part takes. Under-blocking is what shipped a guard blind to its own flagship
// consumer.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import postcss from "postcss";

const SRC = new URL("../src", import.meta.url).pathname;

const GRAPHIC_WORDS = new Set(["icon", "mark", "glyph", "logo"]);

// The text tier — solved at 4.5 for TEXT. `--foreground` is deliberately absent (see above).
const TEXT_TIER =
  /var\(\s*--(muted-foreground|accent-text|(error|warning|success|info)-text)\s*[,)]/i;

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
      // Signal 1 covers every paint property on the graphic itself. Signal 2 covers only the
      // inherited channel, on any rule in a module that contains a graphic.
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
