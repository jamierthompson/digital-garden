// Fails if any CSS under `src/` — CSS Modules AND global sheets alike (reset.css and
// the src/styles token sheets, …) — has a style rule outside an `@layer` block, OR declares
// an `@layer` name outside the allowed two-name set. Next does not
// auto-layer CSS Modules, and a plain global stylesheet is just as unlayered by
// default; either way an unlayered rule silently outranks every @layer style
// regardless of specificity (the "@layer trap"). Wrap rules in the appropriate @layer
// (base | components): global sheets (reset + token tiers) are `base`, CSS Modules are
// `components`. `@layer` statements/blocks and `@media`/`@supports` wrapping layered rules are
// all fine — only a bare top-level style rule, or a stray layer name (in an `@layer` at-rule OR
// an `@import … layer(<name>)`), is a violation.
//
// It ALSO fails on a cross-sheet property collision inside `@layer base` (#257): two
// DIFFERENT base-layer sheets declaring the same property on the same selector. #254 merged
// the former `foundation` + `semantic` layers into one `base` layer; within a single layer the
// winner is decided by SOURCE ORDER (the sheet import order), not tier order. So two base sheets
// that set the same `(selector, property)` are one reorder away from silently flipping which
// value wins. Same-file duplicates are exempt — those are author-visible source order; the
// silent-drift risk is only across sheets.
//
// Two deliberate scope limits: (1) at-rule context (`@media`/`@supports`) is NOT tracked, so a
// cross-sheet duplicate is flagged even under different — even mutually exclusive — queries; the
// exclusive case is a knowing conservative over-block (when both queries can match, source order
// still decides, so flagging is correct for the invariant). (2) Shorthand/longhand overlap
// (`margin` vs `margin-top`) is out of scope — only the exact same property name is compared.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import postcss from "postcss";

const SRC = new URL("../src", import.meta.url).pathname;

function findCss(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findCss(full));
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

// The trimmed params of the nearest enclosing `@layer` BLOCK (`base`, `components`, or `""`
// for an anonymous `@layer { … }`), or `undefined` when the node is in no layer block. `@media`
// / `@supports` are transparent — they establish no layer, so the walk passes through them.
function enclosingLayer(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === "atrule" && p.name === "layer" && p.nodes) {
      return p.params.trim();
    }
  }
  return undefined;
}

// `@keyframes` (and vendor-prefixed variants) offsets — `from`, `to`, `50%` — parse as
// generic Rule nodes with no special-casing. They aren't cascade-layer-participating
// style rules at all, so an unlayered `@keyframes` block (the idiomatic, near-universal
// way to write one) must not be flagged.
function isInsideKeyframes(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === "atrule" && /^(-\w+-)?keyframes$/i.test(p.name)) return true;
  }
  return false;
}

// Split a selector LIST (`:root, .x`) into its members at top-level commas only — a comma
// inside `:where(a, b)` or `[attr="a,b"]` is not a list separator. Each member is normalized
// (trimmed, internal whitespace collapsed) so `:root` matches `:root` regardless of raw
// spacing; that canonical form is what two sheets collide on.
function splitSelectorList(selector) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
}

// Custom properties are case-SENSITIVE (`--Foo` ≠ `--foo`); standard property names are
// case-insensitive, so fold them to lower-case before comparing.
function normalizeProp(prop) {
  return prop.startsWith("--") ? prop : prop.toLowerCase();
}

// The cascade collapses to two layers named for their jobs — `base` (reset + token tiers, loses)
// and `components` (CSS Modules, wins). A stray third name would silently re-introduce the
// tier/layer conflation this set exists to prevent, so enforce the exact two.
const ALLOWED_LAYERS = new Set(["base", "components"]);

const unlayered = [];
const badNames = [];
// `${selector} ${property}` → Map<file, firstLine>. A key seen in ≥2 files is a
// cross-sheet base-layer collision. Property names contain no spaces, so the space-joined
// key is unambiguous, and the entry carries the parts back for a clean report.
const baseDecls = new Map();

for (const file of findCss(SRC)) {
  const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
  const rel = relative(process.cwd(), file);
  const at = (node) => `${rel}:${node.source.start.line}`;
  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    const layer = enclosingLayer(rule);
    if (layer === undefined) {
      unlayered.push(`${at(rule)}  "${rule.selector}"`);
      return;
    }
    if (layer !== "base") return;
    for (const selector of splitSelectorList(rule.selector)) {
      rule.walkDecls((decl) => {
        const property = normalizeProp(decl.prop);
        const key = `${selector} ${property}`;
        let entry = baseDecls.get(key);
        if (!entry)
          baseDecls.set(
            key,
            (entry = { selector, property, byFile: new Map() }),
          );
        if (!entry.byFile.has(rel))
          entry.byFile.set(rel, decl.source.start.line);
      });
    }
  });
  root.walkAtRules("layer", (layer) => {
    for (const name of layer.params.split(",").map((n) => n.trim())) {
      // Skip anonymous layers (`@layer { … }`, empty params) — a valid, unused-here form.
      if (name && !ALLOWED_LAYERS.has(name)) {
        badNames.push(`${at(layer)}  @layer "${name}"`);
      }
    }
  });
  // A layer name can also enter the cascade via `@import "x.css" layer(<name>);` (CSS Cascade L5) —
  // a form `@layer` walking alone misses. Catch a named `layer(...)`; the anonymous `layer` keyword
  // (no parens) is exempt, like an anonymous `@layer { … }`.
  root.walkAtRules("import", (imp) => {
    const name = imp.params.match(/\blayer\(([^)]*)\)/)?.[1].trim();
    if (name && !ALLOWED_LAYERS.has(name)) {
      badNames.push(`${at(imp)}  @import layer("${name}")`);
    }
  });
}

const collisions = [];
for (const { selector, property, byFile } of baseDecls.values()) {
  if (byFile.size < 2) continue;
  const sites = [...byFile.entries()].map(([f, line]) => `${f}:${line}`).sort();
  // Report every colliding pair for the (selector, property) so each offending sheet is named.
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      collisions.push(
        `"${selector}" { ${property} }  ${sites[i]}  ${sites[j]}`,
      );
    }
  }
}

if (unlayered.length || badNames.length || collisions.length) {
  if (unlayered.length) {
    console.error("CSS with rules outside an @layer block:\n");
    for (const v of unlayered) console.error(`  ${v}`);
  }
  if (badNames.length) {
    console.error("\nCSS with an @layer name outside {base, components}:\n");
    for (const v of badNames) console.error(`  ${v}`);
  }
  if (collisions.length) {
    console.error(
      "\nBase-layer property collision across sheets (winner decided by import order, not tier):\n",
    );
    for (const v of collisions) console.error(`  ${v}`);
  }
  const total = unlayered.length + badNames.length + collisions.length;
  console.error(
    `\n${total} violation(s). Wrap rules in @layer (base | components); keep each (selector, property) in one base sheet.`,
  );
  process.exit(1);
}
console.log(
  "CSS: all rules (modules + global sheets) are layered as base | components; base sheets are property-disjoint per selector.",
);
