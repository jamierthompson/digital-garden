import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EntryBody from "@/components/portable-text/EntryBody";
import EntryScope from "@/components/entry-scope/EntryScope";
import EntryScopeBoundary from "@/components/entry-scope/EntryScopeBoundary";
import type { ScopeSeed } from "@/components/entry-scope/scopeSeed";
import RelatedEntries from "@/components/entry/RelatedEntries";
import { resolveComponentKey } from "@/lib/resolvers/components";
import { isNotFound } from "@/lib/resolvers/resolution";
import type { EntryModule } from "@/entries/types";
import { client } from "@/sanity/lib/client";
import { ENTRY_SLUGS_QUERY, ENTRY_DETAIL_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

// The flat entry route: every `entry` — any `kind` — lives at a root-level `/[slug]` (this
// dynamic segment cedes precedence to the static routes `/browse`, `/now`, `/about`, `/system`). Thin
// route (`app/` is routing only — it mounts components from `src/`). The composition:
// EDITORIAL page chrome (article prose, related entries) reads the global semantic
// tier; an entry's brand color + font are scoped to its interactive slot ONLY:
//   <main> editorial chrome
//     ├ <article> the entry's essay (PT serializer) — editorial
//     ├ EntryScopeBoundary + EntryScope + <Experience/> — the brand-themed slot,
//     │   rendered for ANY entry that resolves a module
//     └ <RelatedEntries> — editorial (outgoing `related` + incoming backlinks)
//
// CAPABILITY-gated, not kind-gated: which slot an entry gets is decided by the capability
// fields it carries, not by its `kind` (any kind of entry can be interactive or themed).
//   • Module — a `componentKey` that DECLARES a coded module: present → resolve it; a
//     renamed/deleted module (drift) → `notFound()`, for ANY kind. NO `componentKey` →
//     prose-only, never a 404 (a `stage: sketch` project keeps its key null until it ships,
//     and a note/essay simply never has one).
//   • Theming — a `brandColor`: present → build the scope seed and thread it to the body so
//     each `liveEmbed` mounts in its own scoped container, exactly as a project's do.
//
// `now` is the ONE exception, excluded by design: it stays chrome + prose — never a scope,
// never a module — even if it happens to carry `brandColor`/`componentKey`, because a `now`
// note is an editorial status update, not an interactive slot. The keystone stays defensive:
// the scope never throws on a bad brandColor/fontKey, so an empty seed field is always safe.
//
// PAGE WIDTH (#139) — a module MAY declare `layout: "wide"` to widen the page's content
// container from the narrow editorial max-width to a screen-filling one (owner directive).
// It's a page-level max-width switch on `<main>`, not a per-slot breakout, so it applies to
// the WHOLE composition regardless of shape (Provider + interleaved slots, or an Experience).
// Absent → today's narrow layout, unchanged.

interface EntryPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Enumerate which slugs to prerender at build (Cache Components extracts each one's static
 * shell). Returns EVERY published entry slug — any kind — because every entry now has a flat
 * detail route. Returning the published set does NOT preclude on-demand rendering of others:
 * under PPR an un-enumerated slug still renders at request time (`generate-static-params.md`).
 *
 * Reads the PUBLISHED `client` directly (not `sanityFetch`): build-time enumeration must
 * prerender the published set, and Draft Mode has no meaning during the build.
 */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  "use cache";
  const { cacheLife } = await import("next/cache");
  cacheLife("max");
  const slugs = await client.fetch(ENTRY_SLUGS_QUERY);
  return slugs
    .map((entry) => entry.slug)
    .filter((slug): slug is string => typeof slug === "string")
    .map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: EntryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await sanityFetch(ENTRY_DETAIL_QUERY, { slug });
  if (!entry) {
    return { title: "Not found" };
  }
  const title = entry.title ?? "Untitled entry";
  const description = entry.blurb ?? undefined;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
  };
}

export default async function EntryPage({ params }: EntryPageProps) {
  // Request API is async under Next 16 — `params` is a Promise, awaited before use.
  const { slug } = await params;
  const entry = await sanityFetch(ENTRY_DETAIL_QUERY, { slug });

  // Unpublished / unknown slug → the not-found boundary.
  if (!entry) {
    notFound();
  }

  // `now` is excluded from BOTH capabilities by design (an editorial status update, never an
  // interactive slot) — so it never resolves a key and never builds a scope, even if the doc
  // happens to carry `componentKey`/`brandColor`.
  const isNow = entry.kind === "now";

  // Module gate — capability, not kind. A DECLARED `componentKey` must resolve for any kind
  // except `now`: a renamed/deleted module (drift) → `notFound()`, never a crash. NO
  // `componentKey` → `resolution` is null → prose-only, not a 404 (a sketch project keeps its
  // key null until it ships; a note/essay simply never has one). The resolver is never even
  // consulted without a key, nor for a `now`.
  const resolution =
    !isNow && entry.componentKey
      ? resolveComponentKey(entry.componentKey)
      : null;
  if (resolution && isNotFound(resolution)) {
    notFound();
  }

  // Load the resolved module. Past the guard above, a non-null `resolution` is `found`, so this
  // mounts for ANY kind (except `now`) that declared a resolvable key. The module composes one
  // (or both) of two ways: `Experience` = one slot after the prose; `Provider` = a client frame
  // around the article so `liveEmbed` slots interleaved through the prose share state (see
  // `EntryModule`).
  const entryModule =
    resolution && !isNotFound(resolution)
      ? ((await resolution.value()) as { default: EntryModule }).default
      : null;
  const Experience = entryModule?.Experience ?? null;
  const Provider = entryModule?.Provider ?? null;

  // Page width is a MODULE contract (#139): a module may ask for a screen-filling page instead
  // of the narrow editorial column. Absent → narrow (every existing module + every prose-only
  // entry). Widening happens on the `<main>` container, so the whole composition benefits — no
  // dependence on a particular slot shape.
  const isWide = entryModule?.layout === "wide";

  // The brand seed, threaded to the body so each `liveEmbed` — and the `Experience` slot —
  // mounts in its own scoped container. Built whenever this entry either themes (`brandColor`)
  // OR mounts a module: keyed on the REAL `slug` so a scope never collapses to the shared
  // `data-entry="fallback"` (which would cross-contaminate two such entries via one hoisted
  // `<style>` — see `vetSlug`). An absent `brandColor`/`fontKey` is a safe empty string: the
  // keystone falls back to the engine palette + shell font without throwing. The prose between
  // slots reads the editorial tiers — brand never wraps the article itself.
  const scope: ScopeSeed | undefined =
    !isNow && (entry.brandColor || entryModule)
      ? {
          slug,
          brandColor: entry.brandColor ?? "",
          fontKey: entry.fontKey ?? "",
        }
      : undefined;

  const article = (
    <article className={styles.article}>
      <header className={styles.header}>
        <h1 className={styles.title}>{entry.title}</h1>
        {entry.blurb ? <p className={styles.blurb}>{entry.blurb}</p> : null}
      </header>
      {entry.body ? <EntryBody value={entry.body} scope={scope} /> : null}
    </article>
  );

  return (
    // `.module` caps the page at the editorial measure; the `.wide` modifier (module-declared)
    // overrides that cap with a screen-filling width. `data-layout` records the mode in the
    // markup (the repo's `data-*` vocabulary — cf. `data-entry`/`data-theme`).
    <main
      className={isWide ? `${styles.module} ${styles.wide}` : styles.module}
      data-layout={isWide ? "wide" : "narrow"}
    >
      {/* The provider is a state frame, not a theme: prose inside stays server-rendered
          editorial content (children pass-through). Rendered as deep as possible per the
          bundled composition docs. */}
      {Provider ? <Provider slug={slug}>{article}</Provider> : article}
      {/* Brand is scoped to the interactive slot ONLY — the engine theme wraps
          <Experience/>, not the editorial article/related around it. Rendered only when a
          module resolved (any kind but `now`); an entry without one is prose-only. The
          `.experience` wrapper is the direct `.module` child: it holds the reading-measure cap
          on narrow entries (like every non-article child) but is exempted under `.wide` so a
          module-declared wide Experience fills the frame — the article's `[full]` slots aren't
          the only wide-mode path (a lone Experience is a direct child, not inside the article). */}
      {Experience ? (
        <div className={styles.experience}>
          <EntryScopeBoundary>
            <EntryScope seed={scope}>
              <Experience slug={slug} />
            </EntryScope>
          </EntryScopeBoundary>
        </div>
      ) : null}
      <RelatedEntries
        currentId={entry._id}
        related={entry.related}
        backlinks={entry.backlinks}
      />
    </main>
  );
}
