// The shape every entry module's registry entry (`index.ts`) exports.
//
// A `componentKey` resolves (via `src/lib/resolvers/components.ts`, a LITERAL dynamic
// import per key) to an entry module; this is the contract that module's default
// export satisfies, so a thin `/[slug]` route can mount it without knowing the
// concrete project. A module composes with the editorial page in one (or both) of two
// ways — `Experience` (one interactive slot mounted after the prose) and/or `Provider`
// (a client frame around the article so `liveEmbed` slots interleaved through the prose
// can share state) — and must export at least one; the union below makes an
// empty module a compile error. A module may also declare `layout: "wide"` to ask the
// `/[slug]` route for a screen-filling page width instead of the narrow editorial column
// (owner directive, #139) — see `EntryModuleMembers.layout`.
//
// Lives in shared `src/entries/` (not inside any one project) because it is the
// cross-module contract the resolver and route key off — named where it will live now,
// instantiated on a genuine second use (deferral discipline).

import type { ComponentType, ReactNode } from "react";

/** The one prop every `Experience` takes — see `ExperienceProps.slug` below. */
export interface ExperienceProps {
  /**
   * The route's own slug — the ONE thing an `Experience` needs beyond ambient scope: a
   * value stable and unique per rendered instance, for ids that must not collide. Cache
   * Components can keep several `/[slug]` routes mounted at once (React's `<Activity>`,
   * `docs/architecture.md`), including two different slugs pointed at the SAME shared
   * `Experience` (a module reused by several projects) — a hardcoded id, or even `useId()`
   * (empirically: it also collides across Activity-preserved routes), breaks there. `slug`
   * doesn't.
   */
  readonly slug: string;
}

/** Props for a module's `Provider` — the client frame around the editorial article. */
export interface ProviderProps {
  /** The route's own slug — same collision rationale as `ExperienceProps.slug`. */
  readonly slug: string;
  /**
   * The server-rendered article (prose + interleaved `liveEmbed` slots), passed through
   * as rendered output — the provider adds shared client state around it, never markup
   * that re-themes the editorial register.
   */
  readonly children: ReactNode;
}

/** The members an entry module MAY export — see `EntryModule` for the at-least-one rule. */
interface EntryModuleMembers {
  /**
   * The page WIDTH the module wants for its `/[slug]` entry (owner directive, #139). Absent
   * (the default) keeps today's narrow editorial max-width (`--width-content`) that essays,
   * notes, and every existing module already get. `"wide"` switches the page's content
   * container to a screen-filling max-width so a demo/tool can use the full window.
   *
   * Applied at the PAGE container level (the whole content column widens), NOT a per-slot
   * breakout — so it works for ANY composition: a `Provider` + interleaved `liveEmbed` slots
   * widens exactly as a lone `Experience` would, with no recomposition required. Prose keeps
   * its own reading measure (the article grid caps it), so widening the page doesn't stretch
   * the text; the module's full-width slots take the extra room.
   *
   * A module contract, not a Sanity schema field, so content stays presentation-agnostic (no
   * schema change, no TypeGen, no editor burden).
   */
  readonly layout?: "wide";
  /**
   * One interactive slot, mounted by the page after the prose inside its own brand scope.
   * The default composition for a module whose experience is a single surface.
   */
  readonly Experience?: ComponentType<ExperienceProps>;
  /**
   * A client component the page wraps the `<article>` in when the module exports it. The
   * prose stays server-rendered (`children` pass-through); the provider exists so the
   * module's `liveEmbed` slots — mounted between prose blocks, each in its own scoped
   * container — can share state via context. The documented interleaving pattern:
   * `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.
   */
  readonly Provider?: ComponentType<ProviderProps>;
}

/**
 * An entry module's registry entry — the default export of its `index.ts`. The
 * intersection with the union enforces "at least one composition member" at compile
 * time: a module exporting neither `Experience` nor `Provider` cannot satisfy it.
 */
export type EntryModule = EntryModuleMembers &
  (
    | { readonly Experience: ComponentType<ExperienceProps> }
    | { readonly Provider: ComponentType<ProviderProps> }
  );
