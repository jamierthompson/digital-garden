// The shape every entry module's registry entry (`index.ts`) exports.
//
// A `componentKey` resolves (via `src/lib/resolvers/components.ts`, a LITERAL dynamic
// import per key) to an entry module; this is the contract that module's default
// export satisfies, so a thin `/[slug]` route can mount it without knowing the
// concrete module. There is ONE composition, the same for every `kind`: the module's
// `Provider` frames the entry's article, and the module's interactive pieces mount as
// `slot` blocks interleaved through the prose (`SlotBlock` → `slots/*`), sharing state
// through that frame. A demo is not a second shape — it is an entry that leans on its
// slots, one of which may take the content grid's `full` lane to reach edge-to-edge.
//
// Lives in shared `src/entries/` (not inside any one module) because it is the
// cross-module contract the resolver and route key off — named where it will live now,
// instantiated on a genuine second use (deferral discipline).

import type { ComponentType, ReactNode } from "react";

/** Props for a module's `Provider` — the client state frame around the entry's article. */
export interface ProviderProps {
  /**
   * The route's own slug — the ONE thing the frame needs beyond ambient scope: a
   * value stable and unique per rendered instance, for ids that must not collide. Cache
   * Components can keep several `/[slug]` routes mounted at once (React's `<Activity>`,
   * `docs/architecture.md`), including two different slugs pointed at the SAME shared
   * module (a module reused by several entries) — a hardcoded id, or even `useId()`
   * (empirically: it also collides across Activity-preserved routes), breaks there. `slug`
   * doesn't.
   */
  readonly slug: string;
  /**
   * The server-rendered article with its interleaved `slot` blocks, passed through as
   * rendered output — the provider adds shared client state around it, never markup that
   * re-themes it.
   */
  readonly children: ReactNode;
}

/**
 * An entry module's registry entry — the default export of its `index.ts`. One member,
 * required: a module exists to give its slots a shared client frame, so a module without
 * a `Provider` has nothing to mount and is a compile error.
 *
 * The `Provider` must render NO DOM element of its own (context provider only): the
 * editorial grid assumes children pass through unwrapped. The documented interleaving
 * pattern:
 * `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.
 */
export interface EntryModule {
  readonly Provider: ComponentType<ProviderProps>;
}
