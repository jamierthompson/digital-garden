// The shape every entry module's registry entry (`index.ts`) exports.
//
// A `componentKey` resolves (via `src/lib/resolvers/components.ts`, a LITERAL dynamic
// import per key) to an entry module; this is the contract that module's default
// export satisfies, so a thin `/[slug]` route can mount it without knowing the
// concrete project. A module composes with the editorial page in one (or both) of two
// ways — `Slot` (one interactive slot mounted after the prose) and/or `Provider`
// (a client frame around the article so `slot` blocks interleaved through the prose
// can share state) — and must export at least one; the union below makes an
// empty module a compile error.
//
// Lives in shared `src/entries/` (not inside any one project) because it is the
// cross-module contract the resolver and route key off — named where it will live now,
// instantiated on a genuine second use (deferral discipline).

import type { ComponentType, ReactNode } from "react";

/** The one prop every `Slot` takes — see `SlotProps.slug` below. */
export interface SlotProps {
  /**
   * The route's own slug — the ONE thing a `Slot` needs beyond ambient scope: a
   * value stable and unique per rendered instance, for ids that must not collide. Cache
   * Components can keep several `/[slug]` routes mounted at once (React's `<Activity>`,
   * `docs/architecture.md`), including two different slugs pointed at the SAME shared
   * `Slot` (a module reused by several projects) — a hardcoded id, or even `useId()`
   * (empirically: it also collides across Activity-preserved routes), breaks there. `slug`
   * doesn't.
   */
  readonly slug: string;
}

/** Props for a module's `Provider` — the client frame around the editorial article. */
export interface ProviderProps {
  /** The route's own slug — same collision rationale as `SlotProps.slug`. */
  readonly slug: string;
  /**
   * The server-rendered article (prose + interleaved `slot` blocks), passed through
   * as rendered output — the provider adds shared client state around it, never markup
   * that re-themes the editorial register.
   */
  readonly children: ReactNode;
}

/** The members an entry module MAY export — see `EntryModule` for the at-least-one rule. */
interface EntryModuleMembers {
  /**
   * One interactive slot, mounted by the page after the prose inside its own theme scope.
   * The default composition for a module whose interactive surface is a single slot.
   */
  readonly Slot?: ComponentType<SlotProps>;
  /**
   * A client component the page wraps the `<article>` in when the module exports it. The
   * prose stays server-rendered (`children` pass-through); the provider exists so the
   * module's `slot` blocks — mounted between prose blocks, each in its own scoped
   * container — can share state via context. The documented interleaving pattern:
   * `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.
   */
  readonly Provider?: ComponentType<ProviderProps>;
}

/**
 * An entry module's registry entry — the default export of its `index.ts`. The
 * intersection with the union enforces "at least one composition member" at compile
 * time: a module exporting neither `Slot` nor `Provider` cannot satisfy it.
 */
export type EntryModule = EntryModuleMembers &
  (
    | { readonly Slot: ComponentType<SlotProps> }
    | { readonly Provider: ComponentType<ProviderProps> }
  );
