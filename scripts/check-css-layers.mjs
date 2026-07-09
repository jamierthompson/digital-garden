// Fails if any CSS under `src/` — CSS Modules AND global sheets alike (reset.css and
// the src/styles token sheets, …) — has a style rule outside an `@layer` block. Next does not
// auto-layer CSS Modules, and a plain global stylesheet is just as unlayered by
// default; either way an unlayered rule silently outranks every @layer style
// regardless of specificity (the "@layer trap"). Wrap rules in the appropriate @layer
// (foundation | semantic | components). `@layer` statements/blocks, `@import`,
// and `@media`/`@supports` wrapping layered rules are all fine — only a bare
// top-level style rule is a violation.
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

function isInsideLayer(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === "atrule" && p.name === "layer" && p.nodes) return true;
  }
  return false;
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

const violations = [];
for (const file of findCss(SRC)) {
  const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    if (!isInsideLayer(rule)) {
      violations.push(
        `${relative(process.cwd(), file)}:${rule.source.start.line}  "${rule.selector}"`,
      );
    }
  });
}

if (violations.length) {
  console.error("CSS with rules outside an @layer block:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    `\n${violations.length} violation(s). Wrap rules in @layer (foundation | semantic | components).`,
  );
  process.exit(1);
}
console.log("CSS: all rules (modules + global sheets) are layered.");
