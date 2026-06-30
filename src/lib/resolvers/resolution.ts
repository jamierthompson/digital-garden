// The typed resolution result shared by every key resolver.
//
// Keys are a contract with NO referential integrity: a key saved in Sanity may
// have had its code renamed or deleted. So a resolver never does a bare
// `map[key]` lookup that can hand back `undefined` and crash a render — it
// returns this discriminated `Resolution<T>`. Callers narrow with `isNotFound`
// and render a visible fallback (`not-found.tsx` for a `componentKey` miss, a
// "missing embed" placeholder in the Portable Text serializer for an `embedKey`
// miss), so a content→code drift degrades gracefully instead of throwing.

/** Which kind of key failed to resolve — for fallback messaging / logging. */
export type ResolutionKind = "component" | "font" | "embed";

/** A successful resolution carrying the resolved value. */
export interface Found<T> {
  readonly found: true;
  readonly value: T;
}

/** A failed resolution: the key was not in the registry. */
export interface NotFound {
  readonly found: false;
  readonly kind: ResolutionKind;
  /** The unresolved key, echoed back for fallback messaging / logging. */
  readonly key: string;
}

/** The result of resolving a key: either the value, or a typed `NotFound`. */
export type Resolution<T> = Found<T> | NotFound;

/** Build a successful resolution. */
export function found<T>(value: T): Found<T> {
  return { found: true, value };
}

/** Build a `NotFound` for an unknown key of the given kind. */
export function notFound(kind: ResolutionKind, key: string): NotFound {
  return { found: false, kind, key };
}

/** Narrow a `Resolution<T>` to its `NotFound` branch. */
export function isNotFound<T>(
  resolution: Resolution<T>,
): resolution is NotFound {
  return resolution.found === false;
}
