/**
 * The content-grid lanes a body block may occupy. `wide` is the default for media and slot
 * blocks; `full` is the authored edge-to-edge opt-in; `prose` tucks a block into the reading
 * column. Mirrors the Studio's shared `lane` field (studio/schemaTypes/shared/lane.ts).
 */
export const BLOCK_LANES = ["prose", "wide", "full"] as const;
export type BlockLane = (typeof BLOCK_LANES)[number];

/**
 * Sanitize an authored lane value to the known set — the field is a plain string over the
 * wire, so an absent, drifted, or hostile value collapses to the `wide` default rather than
 * stamping an arbitrary attribute into the DOM.
 */
export function resolveBlockLane(value: unknown): BlockLane {
  return value === "prose" || value === "full" ? value : "wide";
}
