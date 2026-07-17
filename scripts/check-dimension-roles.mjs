// Fails if a component CSS Module reads a raw dimension PRIMITIVE where a semantic role (or a
// co-located component token) is the contract — the dimension mirror of the color layer's
// discipline. Three forbidden forms in a `*.module.css` declaration value:
//   1. raw spacing step      — `var(--space-<N>)`
//   2. radius primitive      — `var(--radius-base)` or a retired scale name (`--radius-md`, …)
//   3. hardcoded measure     — a literal `<N>ch` cap
// The roles live in `src/styles/semantic/` (`--space-flow`, `--radius-surface`, …) and the type
// bundles (`--type-body-measure`); a genuinely component-specific value is bound as a co-located
// component token (`--quote-indent: var(--space-4)`) — a CUSTOM PROPERTY declaration may read the
// foundation scale, a normal declaration may not.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import postcss from "postcss";

const SRC = new URL("../src", import.meta.url).pathname;

// SPACE reads exempt pending their named design passes (SiteNav/SiteFooter redesign; the state
// screens' treatment). Radius + measure rules still apply here. Shrink this list as passes land.
export const SPACE_EXEMPT_PREFIXES = [
  "src/components/page-chrome/",
  "src/app/[slug]/states.module.css",
  "src/app/loading.module.css",
];

const RAW_SPACE = /var\(\s*--space-\d/;
const RAW_RADIUS = /var\(\s*--radius(?:-(?:sm|md|lg|xl|full|base))?\s*[,)]/;
const CH_LITERAL = /(?:^|[\s(,:])\d+(?:\.\d+)?ch\b/;

// PURE detector: violations in one CSS source. Custom-property declarations are the sanctioned
// binding site for component tokens, so they are skipped entirely.
export function findDimensionViolations(
  css,
  { spaceExempt = false, from } = {},
) {
  const root = postcss.parse(css, from ? { from } : undefined);
  const violations = [];
  root.walkDecls((decl) => {
    if (decl.prop.startsWith("--")) return;
    const line = decl.source.start.line;
    if (!spaceExempt && RAW_SPACE.test(decl.value)) {
      violations.push({ line, kind: "raw-space", value: decl.value });
    }
    if (RAW_RADIUS.test(decl.value)) {
      violations.push({ line, kind: "raw-radius", value: decl.value });
    }
    if (CH_LITERAL.test(decl.value)) {
      violations.push({ line, kind: "ch-literal", value: decl.value });
    }
  });
  return violations;
}

function findModules(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findModules(full));
    else if (entry.name.endsWith(".module.css")) out.push(full);
  }
  return out;
}

function main() {
  const violations = [];
  for (const file of findModules(SRC)) {
    const rel = relative(process.cwd(), file);
    const spaceExempt = SPACE_EXEMPT_PREFIXES.some((p) => rel.startsWith(p));
    for (const v of findDimensionViolations(readFileSync(file, "utf8"), {
      spaceExempt,
      from: file,
    })) {
      const how = {
        "raw-space":
          "raw --space-<N> read — use a --space-* role or bind a component token",
        "raw-radius":
          "radius primitive read — use --radius-control/-surface/-pill",
        "ch-literal":
          "hardcoded ch measure — use a --type-<role>-measure token",
      }[v.kind];
      violations.push(`${rel}:${v.line}  ${how}`);
    }
  }

  if (violations.length) {
    console.error("CSS Module reading a raw dimension primitive:\n");
    for (const v of violations) console.error(`  ${v}`);
    console.error(
      `\n${violations.length} violation(s). Component modules read semantic dimension roles ` +
        `(src/styles/semantic/) or their own co-located component tokens — never the raw scale.`,
    );
    process.exit(1);
  }
  console.log(
    "CSS: no component module reads a raw dimension primitive (space scale / radius primitive / ch literal).",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
