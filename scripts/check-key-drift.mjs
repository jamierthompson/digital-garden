// Key-drift guard [D10]. LIVE as of Phase 2.
//
// WHAT KEYS ARE, AND THE TWO DRIFT DIRECTIONS
// -------------------------------------------
// `src/lib/keys.ts` is the single source of truth for which keys exist
// (`FONT_KEYS`, `COMPONENT_KEYS`, `EMBED_KEYS`). Sanity stores a key on a project
// (`fontKey`, `componentKey`, `embedKey`); code resolves it. Two ways this drifts:
//
//   (a) code <-> keys.ts  — a resolver/roster registry that doesn't cover every
//       declared key (or covers a key that doesn't exist). This is ALREADY fully
//       compile-time-enforced: every registry is typed `satisfies Record<XKey,…>`
//       (FONT_FACES, PROJECT_LOADERS, EMBED_LOADERS), so a missing or stray entry
//       is a `pnpm typecheck` error. This script does NOT re-prove that at runtime
//       — it CAN'T usefully, because the resolver/roster modules import `next/font`,
//       which a plain node script can't load. Instead it guards that the enforcement
//       stays WIRED (see check 3): delete a `satisfies` and the compile-time net
//       silently disappears, which a type check alone would not flag.
//
//   (b) published Sanity keys <-> keys.ts — an editor saves a `fontKey` whose code
//       was renamed/deleted (or vice versa). Catching that needs a live GROQ query
//       against the dataset and a Sanity client; it is explicitly **Phase 4**
//       (build-phases.md, "runtime GROQ-published-keys-vs-code net") and OUT OF
//       SCOPE here. Resolvers already degrade gracefully on a miss (typed NotFound),
//       so (b) is a lint/observability net, not a crash risk.
//
// WHAT THIS SCRIPT CHECKS (the honest, node-safe Phase-2 increment)
// -----------------------------------------------------------------
//   1. keys.ts loads and exports the three key arrays (catches a broken/renamed
//      contract module — the thing everything else keys off).
//   2. Each key array is WELL-FORMED: every entry a non-empty kebab-case string,
//      no duplicates within an array, and no collisions ACROSS arrays. Kebab-case
//      and uniqueness are real invariants — keys become Sanity dropdown values and
//      CSS-ish identifiers, and a duplicate/cross-array collision would make a
//      resolver ambiguous. The type system does NOT enforce these (it only checks
//      the literal union), so this is genuine added safety.
//   3. The compile-time guard is still WIRED: each resolver/roster source declares
//      its `satisfies Record<XKey, …>` annotation. This is a comment-stripped
//      source-text (regex) check — NOT a full TS parse — so it's a tripwire, not a
//      proof: it strips `//` and `/* */` comments (so the same phrase quoted in a
//      doc comment can't false-pass) and requires the annotation to follow the
//      registry's closing brace. It fails loudly if someone drops the `satisfies`
//      and reopens direction (a) without `typecheck` noticing. (The compiler is the
//      real enforcer of (a); this only guards that the enforcer stays in place.)
//
// Node 22.21 strips TS types natively, so importing the dependency-free `keys.ts`
// works; the resolver/roster modules are read as TEXT, never imported.

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

// --- 1. Load the contract module ------------------------------------------------

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

// --- 2. Well-formedness: shape, kebab-case, intra- and cross-array uniqueness ---

// Lowercase, digits, single internal hyphens — no leading/trailing/double hyphen.
// Keys surface as Sanity dropdown values and CSS-ish identifiers, so they must be
// stable, lowercase, hyphen-delimited tokens.
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

// --- 3. The compile-time `satisfies Record<XKey,…>` guards are still wired ------

// Each registry that maps a key array to code MUST keep its `satisfies` annotation;
// that — not this script — is what enforces code<->keys completeness (direction a).
// We read the source as text (these modules import next/font and can't be imported
// in a plain node script). The phrase `satisfies Record<XKey, …>` ALSO appears in
// each file's doc comment, so we strip ALL comments first, then require the
// annotation to follow the registry's closing brace (`} satisfies` / `{} satisfies`).
// Stripping (not just line-anchoring) is essential: a trailing or brace-bearing
// comment — e.g. `}; /* TODO restore: } satisfies Record<FontKey, …> */` — would
// otherwise match the live-code pattern and falsely pass even though the real
// annotation is gone. The pattern still tolerates Prettier reflow: `\s*` spans
// newlines, so a real declaration whose `}` and `satisfies` (or whose `Record<…>`
// type args) wrap onto separate lines still matches.

/**
 * Remove `//` line comments and `/* … *\/` block comments (including multiline)
 * from TS/JS source so the `satisfies` check only sees live code. Good enough for
 * these dependency-light registry files: it doesn't parse strings/regex/templates,
 * but none of them carry a `} satisfies Record<…>`-shaped substring, and a false
 * NEGATIVE (over-stripping) would only make the guard stricter, never weaker.
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

// --- Success -------------------------------------------------------------------

const counts = Object.entries(KEY_ARRAYS)
  .map(([n, a]) => `${n}=${a.length}`)
  .join(", ");
console.log(
  `key-drift: OK — keys.ts well-formed (${counts}); ` +
    `${SATISFIES_GUARDS.length} compile-time \`satisfies\` guards wired. ` +
    `(Published-keys-vs-code GROQ net is Phase 4.)`,
);
process.exit(0);
