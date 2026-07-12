// slotKey resolver. Resolves a `slotKey` (from a
// Portable Text `slot` block) to its slot component loader, returning a
// typed `NotFound` for an unknown key — the caller renders a "missing slot"
// placeholder in the serializer rather than crashing the essay.
//
// Single-tier registry by design: an entry-local tier is added only when a
// second entry module reuses a widget.

import { type SlotKey } from "@/lib/keys";

import { found, notFound, type Resolution } from "./resolution";

/** Loads a slot component. */
export type SlotLoader = () => Promise<unknown>;

// `satisfies Record<SlotKey, SlotLoader>` makes a missing loader a compile
// error the moment a key is added to `SLOT_KEYS`. Each value is a LITERAL
// lazy import per key — never templated (a templated import defeats bundler static analysis).
const SLOT_LOADERS = {
  "color-engine-seed": () => import("@/entries/color-engine/slots/SeedSlot"),
  "color-engine-rules": () => import("@/entries/color-engine/slots/RulesSlot"),
  "color-engine-tokens": () =>
    import("@/entries/color-engine/slots/TokensSlot"),
  "color-engine-preview": () =>
    import("@/entries/color-engine/slots/PreviewSlot"),
  "color-engine-export": () =>
    import("@/entries/color-engine/slots/ExportSlot"),
} satisfies Record<SlotKey, SlotLoader>;

// Two variables, two jobs. `SLOT_LOADERS` keeps its literal type so `satisfies`
// enforces completeness against `SlotKey`; `loaders` is the widened, string-keyed
// view the resolver indexes — `resolveSlotKey` takes a raw `string` (a Portable
// Text key with no compile-time `SlotKey` guarantee), so indexing the typed
// `Record<SlotKey, …>` directly would be a type error.
const loaders: Readonly<Record<string, SlotLoader>> = SLOT_LOADERS;

/**
 * Resolve a `slotKey` to its slot loader. Returns `NotFound` for an unknown key.
 */
export function resolveSlotKey(key: string): Resolution<SlotLoader> {
  // Own-property guard: a plain-object index resolves prototype members
  // ("__proto__", "constructor", "toString") to truthy non-loaders, which would
  // crash the page as a Found resolution (QA-131 D1).
  const loader = Object.hasOwn(loaders, key) ? loaders[key] : undefined;
  return loader ? found(loader) : notFound("slot", key);
}
