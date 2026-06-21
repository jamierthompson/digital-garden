// Key-drift guard [D10]. STUB until Phase 2.
//
// The primary defense against keys.ts <-> resolver drift is the type system:
// resolvers typed `satisfies Record<Key, …>` turn a missing entry into a compile
// error (caught by `typecheck`). This script is the CI slot for the additional
// runtime check that goes live in Phase 2 (and the Phase 4 GROQ-published-keys
// net) — reserved now so it can't be forgotten. Today there are no keys.ts files
// to check, so it is intentionally a no-op.
import { existsSync } from "node:fs";

const KEYS_DIR_EXISTS = ["src/projects", "src/embeds", "src/fonts"].some(
  (dir) => existsSync(new URL(`../${dir}`, import.meta.url)),
);

if (!KEYS_DIR_EXISTS) {
  console.log(
    "key-drift: no keys.ts / resolvers yet — stub passes (live in Phase 2).",
  );
  process.exit(0);
}

// TODO (Phase 2): load each keys.ts and assert its resolver satisfies the same
// key set at runtime, complementing the compile-time `satisfies` check.
console.log("key-drift: stub — Phase 2 implementation pending.");
process.exit(0);
