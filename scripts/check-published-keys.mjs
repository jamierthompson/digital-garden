// Published-Sanity-keys → code drift net (issue #39).
//
// `scripts/check-key-drift.mjs` guards direction (a) — code <-> keys.ts — and explicitly
// defers direction (b): a published Sanity key with no code resolver. This script is (b):
// GROQ every DISTINCT published font key / `componentKey` / `slotKey` from the `production`
// dataset and assert each one is a member of the corresponding array in `src/lib/keys.ts`
// (the reference-by-key contract — see docs/architecture.md). It is a read-only net: it
// queries published data and asserts against keys.ts, mutating neither.
//
// Field provenance (verified against the live schema, not memory — `studio/schemaTypes/`):
//   - font keys      live on `entry.theme` as `headingFont` / `bodyFont` / `monoFont` — three
//                     optional roster keys; the query gathers all three (siteSettings has none).
//   - `componentKey` lives on `entry` only.
//   - `slotKey`      lives on `entry.body[]`, nested inside the `slot` block type —
//                     NOT a top-level field, so it needs an array-flatten in the query.
//
// Sanity config + token: reuses `src/sanity/lib/env.ts` for projectId/dataset/apiVersion
// (never hardcoded) and talks to the CDN with the SAME shape as the app's public client
// (`src/sanity/lib/client.ts`): `useCdn: true`, `perspective: "published"`, NO token.
// Published content on this project is served by the CDN unauthenticated — verified
// directly against the live dataset while designing this script. A token would only be
// needed to read drafts, which is deliberately out of scope here.
//
// CI hermeticity: this hits the network, so it is NOT part of `pnpm lint:keys` or the
// blocking local one-command gate (which must stay fast and offline-safe) — it runs as its
// own `published-keys` CI job instead. Because it runs unattended in CI, it must not turn a
// transient network/config problem into a false-red build: any failure to REACH the dataset
// (missing env vars, DNS, timeout, non-2xx) logs a clear SKIP and exits 0. Only a genuine
// drift — a published key with no code resolver — exits 1. The timeout is short (10s) so a
// dead network fails fast rather than hanging the job. A malformed query (HTTP 400 — a bug
// in THIS script, e.g. a typo'd field name) is NOT a network problem and FAILs loud instead
// of skipping quiet; other 4xx/5xx (auth, dataset gone, Sanity outage) still SKIP.
//
// Vacuous-green hardening: `array::unique()` on a renamed/typo'd field resolves to `[]`
// with no error — a broken query and a genuinely empty dataset are indistinguishable from
// the key arrays alone. `findBrokenQuerySignals` below anchors the one published key with a
// schema-required source — `slotKey` (a `slot` block's key is `required()`) — against a
// STRUCTURAL count (a slot *block* count that never references the `slotKey` field name),
// so it FAILs on a broken slotKey query but stays silent when that array is legitimately empty.
// `fontKey` and `componentKey` are both OPTIONAL (#226), so neither can be anchored this way;
// their query shapes are pinned by this script's unit test instead.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

// Published key-bearing fields (de-duplicated), plus the slot-block structural count
// `findBrokenQuerySignals` cross-checks `slotKeys` against and the entry/siteSettings counts
// used only for the OK-line telemetry. `slotKeys` flattens `entry.body[]` (an array of arrays
// across all entries) with the `[]` unwrap before filtering to `slot` blocks;
// `slotBlockCount` reuses that SAME `_type == "slot"` filter but never touches the
// `slotKey` field, so it stays valid even if `slotKey` is renamed. All fields confirmed
// against the live production dataset while designing this script.
const PUBLISHED_KEYS_QUERY = `{
  "entryCount": count(*[_type == "entry"]),
  "siteSettingsCount": count(*[_type == "siteSettings"]),
  "slotBlockCount": count(*[_type == "entry" && count(body[_type == "slot"]) > 0]),
  "fontKeys": array::unique(
    *[_type == "entry" && defined(theme.headingFont)].theme.headingFont
    + *[_type == "entry" && defined(theme.bodyFont)].theme.bodyFont
    + *[_type == "entry" && defined(theme.monoFont)].theme.monoFont
  ),
  "componentKeys": array::unique(*[_type == "entry" && defined(componentKey)].componentKey),
  "slotKeys": array::unique(*[_type == "entry" && defined(body)].body[_type == "slot" && defined(slotKey)].slotKey)
}`;

/**
 * Pure resolving logic: which published keys have no entry in the known (code) set.
 * Exported and unit-tested directly — no network, no process — per keys.test.ts's style.
 */
export function findUnresolvedKeys(publishedKeys, knownKeys) {
  const known = new Set(knownKeys);
  return publishedKeys.filter((key) => !known.has(key));
}

/**
 * Schema-grounded canary against the vacuous-green failure mode: a key array reading `[]`
 * because nothing is published (benign) vs. `[]` because the field path inside the query is
 * wrong (a silent false pass). Only ONE published key has a schema-required source to anchor
 * against: a `slot` block's `slotKey` is `rule.required()`, and `slotBlockCount` is
 * derived from `_type == "slot"` matching ALONE (no `slotKey` reference), so it still
 * holds even if `slotKey` itself were renamed — a published entry with a slot block but
 * zero resolved slotKeys means the slotKey path broke.
 *
 * `fontKey` and `componentKey` carry NO such anchor: every `theme` face AND `componentKey` are
 * OPTIONAL for every kind (#226 deleted `componentKey`'s required-past-seedling validator, joining
 * the three faces), so an empty array for either is a legitimate state — a prose-only evergreen
 * entry publishes zero componentKeys, an entry that sets no face publishes zero fontKeys — not
 * necessarily a broken query. Their query shapes are pinned by this script's unit test instead.
 *
 * The check is gated on `slotBlockCount > 0`, so a genuinely empty dataset — or a garden
 * with no slots — trips nothing; the net stays a clean pass, not a false alarm. Exported and
 * unit-tested directly, same as `findUnresolvedKeys`.
 */
export function findBrokenQuerySignals(published) {
  const signals = [];
  if (published.slotBlockCount > 0 && published.slotKeys.length === 0) {
    signals.push(
      `${published.slotBlockCount} published entry(ies) contain a slot block ` +
        "but zero slotKey values resolved — the slotKey query is likely broken.",
    );
  }
  return signals;
}

function skip(reason) {
  console.log(`check-published-keys: SKIP — ${reason}`);
  process.exit(0);
}

function fail(msg) {
  console.error(`check-published-keys: FAIL — ${msg}`);
  process.exit(1);
}

async function main() {
  // `env.ts` throws synchronously on a missing NEXT_PUBLIC_SANITY_* var — that's a config
  // gap, not a code drift, so it degrades to SKIP rather than failing the build.
  let env;
  try {
    env = await import(new URL("src/sanity/lib/env.ts", root).href);
  } catch (err) {
    skip(`Sanity config unavailable (${err.message}).`);
  }

  const keys = await import(new URL("src/lib/keys.ts", root).href).catch(
    (err) => {
      // Unlike env config, keys.ts is checked into the repo — a failure to load it is a
      // real problem (mirrors check-key-drift.mjs's hard failure on the same import).
      fail(`could not import src/lib/keys.ts (${err.message})`);
    },
  );

  const { createClient } = await import("@sanity/client");
  const client = createClient({
    projectId: env.projectId,
    dataset: env.dataset,
    apiVersion: env.apiVersion,
    useCdn: true,
    perspective: "published",
  });

  let published;
  try {
    published = await client.fetch(
      PUBLISHED_KEYS_QUERY,
      {},
      {
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch (err) {
    // A 400 means Sanity rejected the query itself (e.g. a GROQ parse error from a typo'd
    // edit to PUBLISHED_KEYS_QUERY) — a bug in THIS script, not a network/config problem.
    // Failing loud here closes the same vacuous-green class of gap as the canaries below:
    // a broken query must never read as a clean, silent pass.
    if (err?.statusCode === 400) {
      fail(
        `the GROQ query was rejected by Sanity (400 Bad Request) — this is a broken ` +
          `query, not a network problem: ${err.message}`,
      );
    }
    skip(`could not reach the "${env.dataset}" dataset (${err.message}).`);
    return;
  }

  const brokenQuerySignals = findBrokenQuerySignals(published);
  if (brokenQuerySignals.length > 0) {
    fail(
      `the published-keys query looks broken, not benignly empty —\n` +
        brokenQuerySignals.map((s) => `  ${s}`).join("\n"),
    );
  }

  const categories = [
    { name: "fontKey", published: published.fontKeys, known: keys.FONT_KEYS },
    {
      name: "componentKey",
      published: published.componentKeys,
      known: keys.COMPONENT_KEYS,
    },
    {
      name: "slotKey",
      published: published.slotKeys,
      known: keys.SLOT_KEYS,
    },
  ];

  const drift = categories
    .map(({ name, published, known }) => ({
      name,
      unresolved: findUnresolvedKeys(published, known),
    }))
    .filter(({ unresolved }) => unresolved.length > 0);

  if (drift.length > 0) {
    const lines = drift.map(
      ({ name, unresolved }) =>
        `  ${name}: ${unresolved.map((k) => `"${k}"`).join(", ")}`,
    );
    fail(
      `published Sanity key(s) with no code resolver in src/lib/keys.ts —\n${lines.join("\n")}`,
    );
  }

  const counts = categories
    .map(({ name, published }) => `${name}=${published.length}`)
    .join(", ");
  console.log(
    `check-published-keys: OK — every published key resolves in src/lib/keys.ts (${counts}; ` +
      `entries=${published.entryCount}, siteSettings=${published.siteSettingsCount}, ` +
      `slotBlocks=${published.slotBlockCount}).`,
  );
  process.exit(0);
}

// Only run the network check when executed directly — importing this module (e.g. from
// the co-located unit test, for `findUnresolvedKeys`) must stay side-effect-free.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // `keys.ts` / `env.ts` have no nearby "type" field, so type-stripping them triggers a
  // benign `MODULE_TYPELESS_PACKAGE_JSON` perf warning Node's loader prints directly (a
  // `process.on("warning")` listener can't suppress it) — re-exec once with
  // `--disable-warning` set, same as check-key-drift.mjs. The marker env var prevents an
  // infinite re-exec loop.
  if (!process.env.PUBLISHED_KEYS_REEXEC) {
    const result = spawnSync(
      process.execPath,
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        fileURLToPath(import.meta.url),
      ],
      { stdio: "inherit", env: { ...process.env, PUBLISHED_KEYS_REEXEC: "1" } },
    );
    process.exit(result.status ?? 1);
  }
  await main();
}
