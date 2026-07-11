import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EntryBody from "@/components/portable-text/EntryBody";
import Page from "@/components/layout/Page";
import PageTheme from "@/components/theme/PageTheme";
import EntryScope from "@/components/entry-scope/EntryScope";
import EntryScopeBoundary from "@/components/entry-scope/EntryScopeBoundary";
import type { ScopeSeed } from "@/components/entry-scope/scopeSeed";
import RelatedEntries from "@/components/entry/RelatedEntries";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import { resolveComponentKey } from "@/lib/resolvers/components";
import { isNotFound } from "@/lib/resolvers/resolution";
import type { EntryModule } from "@/entries/types";
import { client } from "@/sanity/lib/client";
import { ENTRY_SLUGS_QUERY, ENTRY_DETAIL_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

// The flat entry route: every `entry` — any `kind` — lives at a root-level `/[slug]` (this
// dynamic segment cedes precedence to the static routes `/browse`, `/now`, `/about`, `/system`). Thin
// route (`app/` is routing only — it mounts components from `src/`).
//
// ONE editorial template for every entry — chrome + the entry's prose — with two optional,
// capability-gated additions layered on: an interactive module slot and a theme-scoped theme.
//
//     <main> editorial chrome
//       ├ <article> the entry's essay (PT serializer) — editorial
//       ├ EntryScopeBoundary + EntryScope + <Experience/> — the themed slot,
//       │   rendered for ANY entry (except `now`) that resolves a module
//       └ <RelatedEntries> — editorial (outgoing `related` + incoming backlinks)
//
// CAPABILITY-gated, never kind-gated: which additions an entry gets is decided by the
// capability fields it carries, not its `kind` (any kind of entry can be interactive or themed).
//   • Module — a `componentKey` that DECLARES a coded module: present → resolve it; a
//     renamed/deleted module (drift) → `notFound()`, for ANY kind. NO `componentKey` →
//     prose-only, never a 404 (a `stage: sketch` project keeps its key null until it ships,
//     and a note/essay simply never has one). A module composes one (or both) of two ways —
//     `Experience` (one slot mounted after the prose) and/or `Provider` (a client frame around
//     the article so interleaved `liveEmbed` slots share state).
//   • Theming — a `theme.color`: present → build the scope seed and thread it to the body so
//     each `liveEmbed` (and the `Experience` slot) mounts in its own scoped container.
//
// `now` is the ONE exception, excluded by design: it stays chrome + prose — never a scope,
// never a module — even if it happens to carry `theme`/`componentKey`, because a `now`
// note is an editorial status update, not an interactive slot. The keystone stays defensive:
// the scope never throws on a bad theme color/font, so an empty seed field is always safe.

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

  // The page's authored theme, applied flash-free (#166/#187). `themeSeed` is resolved
  // KIND-GATED in the query (a `now` update wears the `/now` seed; every other kind wears its
  // own required `theme.color`), so the page never branches on `kind` here. `entry` is already
  // awaited above, so the synchronous `<PageTheme>` emits its `:root` `<style>` into the
  // prerendered static shell — React hoists it into `<head>`, ahead of the chrome.
  const pageTheme = <PageTheme seed={entry.themeSeed} />;

  // `now` is excluded from BOTH capabilities by design (an editorial status update, never an
  // interactive slot) — so it never resolves a key and never builds a scope, even if the doc
  // happens to carry `componentKey`/`theme`.
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

  // The font seed for the entry's slot(s), threaded to the body so each `liveEmbed` — and the
  // `Experience` slot — mounts in its own `[data-entry]` wearing the entry's theme fonts. Built
  // whenever this entry either themes (`theme.color`) OR mounts a module: keyed on the REAL `slug`
  // so a scope never collapses to the shared `data-entry="fallback"`. Each of the three role fonts
  // is passed as `undefined` when absent (never coerced to `""`): the keystone omits an absent
  // role's override so it inherits `:root`, without throwing. The slot's COLOR comes from the
  // page's `<html>` theme (inherited); this seed carries only the fonts.
  const scope: ScopeSeed | undefined =
    !isNow && (entry.theme?.color || entryModule)
      ? {
          slug,
          headingFont: entry.theme?.headingFont ?? undefined,
          bodyFont: entry.theme?.bodyFont ?? undefined,
          monoFont: entry.theme?.monoFont ?? undefined,
        }
      : undefined;

  const article = (
    <article className={styles.article}>
      <header className={styles.header}>
        <Heading level={1} className={styles.title}>
          {entry.title}
        </Heading>
        {entry.blurb ? (
          <Text variant="lead" className={styles.blurb}>
            {entry.blurb}
          </Text>
        ) : null}
      </header>
      {entry.body ? <EntryBody value={entry.body} scope={scope} /> : null}
    </article>
  );

  return (
    <>
      {pageTheme}
      <Page width="page" className={styles.module}>
        {/* The provider is a state frame, not a theme: prose inside stays server-rendered
          editorial content (children pass-through). Rendered as deep as possible per the
          bundled composition docs. */}
        {Provider ? <Provider slug={slug}>{article}</Provider> : article}
        {/* The theme is scoped to the interactive slot ONLY — the engine theme wraps
          <Experience/>, not the editorial article/related around it. Rendered only when a
          module resolved (any kind but `now`); an entry without one is prose-only. The wrapper
          `<div>` is a direct `.module` child, so it holds the reading-measure cap
          (`.module > :not(.article)`) like every non-article child. */}
        {Experience ? (
          <div>
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
      </Page>
    </>
  );
}
