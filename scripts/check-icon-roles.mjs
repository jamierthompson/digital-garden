// Fails if a component CSS Module paints a non-text GRAPHIC from a text-tier color token.
//
// WCAG 2.2 SC 1.4.11 (Non-text Contrast, https://www.w3.org/TR/WCAG22/#non-text-contrast) governs
// icons, marks and glyphs at 3:1 — the engine's `ui` tier. The text roles (`--foreground`,
// `--muted-foreground`, `--accent-text`, the four `--<status>-text`) are solved at 4.5 because
// they are for TEXT. A graphic reading one is over-solved and, more to the point, is reading a
// role that does not describe its job — the drift this guard exists to stop.
//
// The neutral graphic ink is `--icon` (neutral ramp, `ui` tier). `--foreground` is ALLOWED: it is
// the same neutral ramp at full strength, so a graphic moving between `--icon` and `--foreground`
// is a strength change within one role — that is how an icon's emphasis/hover state is expressed.
// `--muted-foreground` is NOT allowed: its job is secondary *text*, and its graphic counterpart
// is `--icon` itself. A graphic may also wear a FILL (`--accent`, `--accent-hover`, a status
// fill) or an on-fill label (`--accent-foreground`, `--<status>-foreground`) when it sits ON that
// fill — solved against their own fill, so allowed.
//
// A "graphic" rule is one whose selector targets an `svg` element or names an icon-like part
// (`.icon`, `.mark`, `.glyph`, `.logo`). That is a CONVENTION, not a proof — CSS alone cannot
// know what an element renders. Name icon parts accordingly and the guard sees them; the
// convention is the contract.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import postcss from "postcss";

const SRC = new URL("../src", import.meta.url).pathname;

// Selector shapes that denote a non-text graphic. CSS Modules hash class names at build time,
// but the SOURCE selector is what we read, so the authored name is intact here.
const GRAPHIC_SELECTOR =
  /(^|[\s>+~(.])(svg\b|[a-z-]*(icon|mark|glyph|logo)[a-z-]*\b)/i;

// The text tier — solved at 4.5 for TEXT. Reading one to paint a graphic is the violation.
// `--foreground` is deliberately absent (see the header note): it is the neutral ramp's full
// strength, the legitimate emphasis end of a graphic's own ramp.
const TEXT_TIER =
  /var\(\s*--(muted-foreground|accent-text|(error|warning|success|info)-text)\s*[,)]/i;

// Properties that actually paint a graphic. `color` counts: an SVG taking `currentColor` — the
// whole reason a text token is tempting here — is painted by it.
const PAINT_PROPS = new Set(["color", "fill", "stroke"]);

const strip = (value) => value.replace(/\/\*[\s\S]*?\*\//g, " ");

/**
 * Resolve a paint value through locally-declared component tokens.
 *
 * `--logo-ink: var(--muted-foreground); color: var(--logo-ink)` is the SAME violation as reading
 * the text role inline — the indirection is a naming step, not a semantic one. Following it is
 * what stops a component token being used (accidentally or otherwise) to launder a text role
 * onto a graphic. Bounded by the seen-set, so a cyclic declaration terminates instead of hanging.
 */
function resolveValue(value, tokens, seen = new Set()) {
  let resolved = strip(value);
  for (const [, name] of resolved.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
    if (seen.has(name) || !(name in tokens)) continue;
    seen.add(name);
    resolved += " " + resolveValue(tokens[name], tokens, seen);
  }
  return resolved;
}

/** PURE detector: violations in one CSS source. */
export function findIconRoleViolations(css, { from } = {}) {
  const root = postcss.parse(css, from ? { from } : undefined);

  // Every custom property declared anywhere in the module, so a paint read can be followed to
  // the role it ultimately resolves to. Module-local by design: a token from another file is
  // that file's contract, and is checked where IT is declared.
  const tokens = {};
  root.walkDecls((decl) => {
    if (decl.prop.startsWith("--")) tokens[decl.prop] = decl.value;
  });

  const violations = [];
  root.walkRules((rule) => {
    if (!GRAPHIC_SELECTOR.test(rule.selector)) return;
    rule.walkDecls((decl) => {
      // Declaring a token is not painting with it — the violation is caught at the paint site,
      // after the indirection is resolved.
      if (decl.prop.startsWith("--")) return;
      if (!PAINT_PROPS.has(decl.prop.toLowerCase())) return;
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
        `--icon (the neutral graphic ink), or from a fill they sit on (--accent, --accent-hover, ` +
        `a status fill and its --*-foreground label). The --*-text roles are solved at 4.5 for ` +
        `TEXT; reading one for a graphic is the wrong role, not merely extra contrast.`,
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
