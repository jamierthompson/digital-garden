// Key-drift guard [D10].
//
// `src/lib/keys.ts` is the single source of truth for which keys exist (`FONT_KEYS`,
// `COMPONENT_KEYS`, `EMBED_KEYS`). Sanity stores a key on a project; code resolves it.
// Two drift directions:
//
//   (a) code <-> keys.ts — a registry that doesn't cover every declared key (or covers a
//       missing one). ALREADY compile-time-enforced: every registry is typed
//       `satisfies Record<XKey,…>` (FONT_FACES, PROJECT_LOADERS, EMBED_LOADERS), so a gap
//       is a `pnpm typecheck` error. This script can't re-prove that at runtime — the
//       registries import `next/font`, which a plain node script can't load. Instead it
//       guards that the enforcement stays WIRED (check 3): drop a `satisfies` and the
//       compile-time net silently disappears, which typecheck alone won't flag.
//
//   (b) published Sanity keys <-> keys.ts — needs a live GROQ query + Sanity client; OUT
//       OF SCOPE, tracked in the issue backlog. Resolvers degrade gracefully on a miss
//       (typed NotFound), so (b) is a lint/observability net, not a crash risk.
//
// What this checks: (1) keys.ts loads and exports the three arrays; (2) each array is
// well-formed — non-empty kebab-case, unique within and across arrays (real invariants the
// type system does NOT enforce: keys become Sanity dropdown values / CSS-ish identifiers,
// and a collision makes a resolver ambiguous); (3) each registry still carries its
// `satisfies` annotation.
//
// Node 22.21 strips TS types natively, so importing the dependency-free `keys.ts` works;
// the registry modules are read as TEXT, never imported.

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// `keys.ts` has no nearby "type" field, so type-stripping it triggers a benign perf
// warning (`MODULE_TYPELESS_PACKAGE_JSON`) that Node's loader prints directly —
// a `process.on("warning")` listener can't suppress it. Node 22's
// `--disable-warning` flag can, but only at startup, so we re-exec ourselves once
// with the flag set, keeping the CI log clean without editing the root package.json.
// The marker env var prevents an infinite re-exec loop.
if (!process.env.KEY_DRIFT_REEXEC) {
  const result = spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      fileURLToPath(import.meta.url),
    ],
    { stdio: "inherit", env: { ...process.env, KEY_DRIFT_REEXEC: "1" } },
  );
  process.exit(result.status ?? 1);
}

const root = new URL("../", import.meta.url);
const fail = (msg) => {
  console.error(`key-drift: FAIL — ${msg}`);
  process.exit(1);
};

// 1. Load the contract module.
const keys = await import(new URL("src/lib/keys.ts", root).href).catch(
  (err) => {
    fail(`could not import src/lib/keys.ts (${err.message})`);
  },
);

const KEY_ARRAYS = {
  FONT_KEYS: keys.FONT_KEYS,
  COMPONENT_KEYS: keys.COMPONENT_KEYS,
  EMBED_KEYS: keys.EMBED_KEYS,
};

for (const [name, value] of Object.entries(KEY_ARRAYS)) {
  if (!Array.isArray(value)) {
    fail(`keys.ts must export \`${name}\` as an array (got ${typeof value}).`);
  }
}

// 2. Well-formedness: shape, kebab-case, intra- and cross-array uniqueness.

// Lowercase, digits, single internal hyphens — no leading/trailing/double hyphen.
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const seen = new Map(); // key -> array name it first appeared in (cross-array net)

for (const [name, arr] of Object.entries(KEY_ARRAYS)) {
  const localSeen = new Set();
  for (const key of arr) {
    if (typeof key !== "string" || key.length === 0) {
      fail(
        `${name} contains a non-string / empty entry: ${JSON.stringify(key)}`,
      );
    }
    if (!KEBAB.test(key)) {
      fail(
        `${name} entry "${key}" is not kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$).`,
      );
    }
    if (localSeen.has(key)) {
      fail(`${name} contains a duplicate entry "${key}".`);
    }
    localSeen.add(key);
    if (seen.has(key)) {
      fail(
        `key "${key}" appears in both ${seen.get(key)} and ${name} — keys must be unique across arrays.`,
      );
    }
    seen.set(key, name);
  }
}

// 3. The compile-time `satisfies Record<XKey,…>` guards are still wired.

// Each registry MUST keep its `satisfies` annotation — that, not this script, enforces
// code<->keys completeness (direction a). Read as text (the modules import next/font and
// can't be imported here). The phrase ALSO appears in each file's doc comment, so strip ALL
// comments first, then require the annotation to follow the registry's closing brace.
// Stripping (not just line-anchoring) is essential: a brace-bearing comment — e.g.
// `}; /* TODO restore: } satisfies Record<FontKey, …> */` — would otherwise match the
// live-code pattern and falsely pass. `\s*` spans newlines, so a real annotation reflowed
// by Prettier onto separate lines still matches.

/**
 * Strip `//` and `/* … *\/` comments so the `satisfies` check sees only live code. Good
 * enough for these registry files: it doesn't parse strings/regex/templates, but none carry
 * a `} satisfies Record<…>`-shaped substring, and over-stripping would only make the guard
 * stricter, never weaker.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments, incl. multiline
    .replace(/\/\/[^\n]*/g, ""); // line comments to end of line
}

const SATISFIES_GUARDS = [
  {
    file: "src/fonts/roster.ts",
    pattern: /\}\s*satisfies\s+Record<\s*FontKey\s*,/,
    note: "FONT_FACES must stay `satisfies Record<FontKey, FontFace>`",
  },
  {
    file: "src/lib/resolvers/components.ts",
    pattern: /\}\s*satisfies\s+Record<\s*ComponentKey\s*,/,
    note: "PROJECT_LOADERS must stay `satisfies Record<ComponentKey, ProjectLoader>`",
  },
  {
    file: "src/lib/resolvers/embeds.ts",
    pattern: /\}\s*satisfies\s+Record<\s*EmbedKey\s*,/,
    note: "EMBED_LOADERS must stay `satisfies Record<EmbedKey, EmbedLoader>`",
  },
];

for (const { file, pattern, note } of SATISFIES_GUARDS) {
  const path = fileURLToPath(new URL(file, root));
  const src = await readFile(path, "utf8").catch((err) => {
    fail(`could not read ${file} (${err.message})`);
  });
  if (!pattern.test(stripComments(src))) {
    fail(
      `${file} is missing its compile-time guard — ${note}. ` +
        `Without it, code<->keys drift is no longer a typecheck error [D10].`,
    );
  }
}

const counts = Object.entries(KEY_ARRAYS)
  .map(([n, a]) => `${n}=${a.length}`)
  .join(", ");
console.log(
  `key-drift: OK — keys.ts well-formed (${counts}); ` +
    `${SATISFIES_GUARDS.length} compile-time \`satisfies\` guards wired. ` +
    `(Published-keys-vs-code GROQ net is tracked in the issue backlog.)`,
);
process.exit(0);
