// Fails if any CSS Module (*.module.css) has a style rule outside an `@layer`
// block. Next does not auto-layer CSS Modules, so an unlayered module silently
// outranks every @layer style regardless of specificity — wrap module rules in
// the appropriate @layer (foundation | brand | project) [D12].
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import postcss from "postcss";

const SRC = new URL("../src", import.meta.url).pathname;

/** Recursively collect every *.module.css path under a directory. */
function findModuleCss(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findModuleCss(full));
    else if (entry.name.endsWith(".module.css")) out.push(full);
  }
  return out;
}

/** True if the node is inside an `@layer { ... }` block. */
function isInsideLayer(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === "atrule" && p.name === "layer" && p.nodes) return true;
  }
  return false;
}

const violations = [];
for (const file of findModuleCss(SRC)) {
  const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
  root.walkRules((rule) => {
    if (!isInsideLayer(rule)) {
      violations.push(
        `${relative(process.cwd(), file)}:${rule.source.start.line}  "${rule.selector}"`,
      );
    }
  });
}

if (violations.length) {
  console.error("CSS Modules with rules outside an @layer block [D12]:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    `\n${violations.length} violation(s). Wrap rules in @layer (foundation | brand | project).`,
  );
  process.exit(1);
}
console.log("CSS Modules: all rules are layered.");
