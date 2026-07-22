export interface NeighborDoc {
  readonly _id: string;
}

/**
 * The distinct neighbors of an entry — the union of its outgoing `related` edges and its
 * incoming `backlinks`, with the graph's ragged shapes washed out: a dangling reference
 * (dereferenced to `null`), a self-reference, and a both-directions duplicate each collapse
 * away. The ONE place this dedupe lives: `RelatedEntries` renders the result and the detail
 * header counts it, so the "N Related" hint and the Related list agree by construction.
 */
export function distinctNeighbors<T extends NeighborDoc>(
  currentId: string,
  related: readonly (T | null)[] | null,
  backlinks: readonly (T | null)[] | null,
): T[] {
  const seen = new Set<string>([currentId]);
  const neighbors: T[] = [];
  for (const entry of [...(related ?? []), ...(backlinks ?? [])]) {
    if (!entry || seen.has(entry._id)) continue;
    seen.add(entry._id);
    neighbors.push(entry);
  }
  return neighbors;
}
