// The shape every entry module's registry entry (`index.ts`) exports.
//
// A `componentKey` resolves (via `src/lib/resolvers/components.ts`, a LITERAL dynamic
// import per key) to an entry module; this is the contract that module's default
// export satisfies, so a thin `/[slug]` route can mount it without knowing the
// concrete module. Which members mount is the ENTRY'S choice, decided by its `kind`:
//   • a demo mounts `Canvas` (the module-owned main surface) and, when exported,
//     `Sidebar` (the module's controls inside the page-owned sidebar shell);
//   • an editorial entry mounts `slot` blocks interleaved through its prose
//     (`SlotBlock` → `slots/*`), sharing state through `Provider`.
// `Provider` serves both templates — a client frame around whatever surface the
// entry renders. The union below makes an empty module a compile error.
//
// Lives in shared `src/entries/` (not inside any one module) because it is the
// cross-module contract the resolver and route key off — named where it will live now,
// instantiated on a genuine second use (deferral discipline).

import type { ComponentType, ReactNode } from "react";

/** The one prop every mounted module surface takes — see `slug` below. */
export interface ModuleSurfaceProps {
  /**
   * The route's own slug — the ONE thing a surface needs beyond ambient scope: a
   * value stable and unique per rendered instance, for ids that must not collide. Cache
   * Components can keep several `/[slug]` routes mounted at once (React's `<Activity>`,
   * `docs/architecture.md`), including two different slugs pointed at the SAME shared
   * surface (a module reused by several entries) — a hardcoded id, or even `useId()`
   * (empirically: it also collides across Activity-preserved routes), breaks there. `slug`
   * doesn't.
   */
  readonly slug: string;
}

/** Props for a module's `Provider` — the client state frame around the entry's surface. */
export interface ProviderProps {
  /** The route's own slug — same collision rationale as `ModuleSurfaceProps.slug`. */
  readonly slug: string;
  /**
   * The server-rendered surface (the editorial article with its interleaved `slot`
   * blocks, or the demo's sidebar + canvas), passed through as rendered output — the
   * provider adds shared client state around it, never markup that re-themes it.
   */
  readonly children: ReactNode;
}

/** The members an entry module MAY export — see `EntryModule` for the at-least-one rule. */
interface EntryModuleMembers {
  /**
   * A client component the page wraps the entry's surface in when the module exports it.
   * The surface stays server-rendered (`children` pass-through); the provider exists so
   * the module's pieces — interleaved `slot` blocks, or a demo's sidebar controls and
   * canvas — can share state via context. It must render NO DOM element of its own
   * (context provider only): the demo bleed's direct-child stretch chain and the
   * editorial grid both assume children pass through unwrapped. The documented
   * interleaving pattern:
   * `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.
   */
  readonly Provider?: ComponentType<ProviderProps>;
  /**
   * The module's sidebar controls, mounted by the demo template inside the page-owned
   * sidebar shell, below the entry's info. Meaningless without `Canvas`.
   */
  readonly Sidebar?: ComponentType<ModuleSurfaceProps>;
  /**
   * The module-owned main surface of a demo — fills the canvas region of the
   * sidebar + canvas template. A demo entry whose module lacks `Canvas` is drift
   * (the route 404s, same as an unresolvable `componentKey`).
   */
  readonly Canvas?: ComponentType<ModuleSurfaceProps>;
}

/**
 * An entry module's registry entry — the default export of its `index.ts`. The
 * intersection with the union enforces "at least one mountable composition" at compile
 * time: a module must export a `Provider` (editorial interleaving) and/or a `Canvas`
 * (demo); `Sidebar` alone cannot satisfy it.
 */
export type EntryModule = EntryModuleMembers &
  (
    | { readonly Provider: ComponentType<ProviderProps> }
    | { readonly Canvas: ComponentType<ModuleSurfaceProps> }
  );
