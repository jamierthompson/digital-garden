import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EntryBody from "@/components/portable-text/EntryBody";
import ContentGrid from "@/components/layout/ContentGrid";
import Page from "@/components/layout/Page";
import Stack from "@/components/layout/Stack";
import PageTheme from "@/components/theme/PageTheme";
import DemoLayout from "@/components/entry/DemoLayout";
import EntryMeta from "@/components/entry/EntryMeta";
import EntryScope from "@/components/entry-scope/EntryScope";
import EntryScopeBoundary from "@/components/entry-scope/EntryScopeBoundary";
import type { ScopeSeed } from "@/components/entry-scope/scopeSeed";
import RelatedEntries from "@/components/entry/RelatedEntries";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import { resolveComponentKey } from "@/lib/resolvers/components";
import { distinctNeighbors } from "@/lib/distinctNeighbors";
import { space } from "@/lib/tokens";
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
// TWO templates, branched by `kind`:
//   • EDITORIAL (note · essay · now — and any kind the code doesn't know): the prose reading
//     column — chrome + the entry's article, with interactive `slot` blocks interleaved through
//     the prose (`SlotBlock`), each in its own theme scope, sharing state through the module's
//     `Provider` frame.
//   • DEMO (`kind === "demo"` with a resolved module): the sidebar + canvas app layout
//     (`DemoLayout`), edge-to-edge in the grid's `full` lane. Hybrid sidebar: the page renders
//     the entry's info; the module contributes its `Sidebar` controls and owns the `Canvas`.
//     A demo has no prose article — its summary is the prose. A sketch demo (no componentKey)
//     falls back to the editorial template, prose-only.
//
// CAPABILITY-gated within each template:
//   • Module — a `componentKey` DECLARES a coded module: present → resolve it for ANY kind; a
//     renamed/deleted module (drift) → `notFound()`. NO `componentKey` → prose-only, never a
//     404. A demo whose resolved module lacks `Canvas` is the same drift.
//   • Theming — a `theme.color`: present → build the scope seed so each slot (or the demo
//     surface) mounts in its own scoped container. `now` is the ONE theming exception: it wears
//     the shared `/now` seed (the query's kind-gated rung) and its slots keep the Now theme's
//     type — the doc's own `theme` never applies, even if authored. The keystone stays
//     defensive: the scope never throws on a bad theme color/font.

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
  const description = entry.summary ?? undefined;
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

  // The page's authored theme, applied flash-free (#166/#187). `themeSeed` is resolved in the
  // query — a KIND-GATED inner rung (a `now` update wears the `/now` seed; every other kind wears
  // its own `theme.color`) over the site-default fallback (#253) — so the page never branches on
  // `kind` here. `entry` is already awaited above, so the synchronous `<PageTheme>` emits its
  // `:root` `<style>` into the prerendered static shell — React hoists it into `<head>`, ahead
  // of the chrome.
  const pageTheme = <PageTheme seed={entry.themeSeed} />;

  // Module gate — capability, not kind. A DECLARED `componentKey` must resolve for ANY kind:
  // a renamed/deleted module (drift) → `notFound()`, never a crash. NO `componentKey` →
  // `resolution` is null → prose-only, not a 404 (a sketch demo keeps its key null until it
  // ships; a note/essay simply never has one). The resolver is never consulted without a key.
  const resolution = entry.componentKey
    ? resolveComponentKey(entry.componentKey)
    : null;
  if (resolution && isNotFound(resolution)) {
    notFound();
  }

  const entryModule =
    resolution && !isNotFound(resolution)
      ? ((await resolution.value()) as { default: EntryModule }).default
      : null;
  const Provider = entryModule?.Provider ?? null;
  const Sidebar = entryModule?.Sidebar ?? null;
  const Canvas = entryModule?.Canvas ?? null;

  // `now` never carries its OWN theme — it wears the shared `/now` seed, and its slots keep the
  // Now theme's type, so the scope seed omits the doc's font fields for a `now` even when they
  // are authored. Every other kind seeds its authored role fonts. Built whenever the entry
  // either themes (`theme.color`, non-`now`) OR mounts a module: keyed on the REAL `slug` so a
  // scope never collapses to the shared `data-entry="fallback"`. Absent role fonts pass as
  // `undefined` (never `""`): the keystone omits them so they inherit `:root`. The scope's
  // COLOR always comes from the page's `<html>` theme (inherited); this seed carries fonts only.
  // The header's backlink hint — counted from the SAME arrays `RelatedEntries` renders
  // (one shared dedupe), so "N linked" and the Related list below agree by construction.
  const linkCount = distinctNeighbors(
    entry._id,
    entry.related,
    entry.backlinks,
  ).length;

  const isNow = entry.kind === "now";
  const scope: ScopeSeed | undefined =
    (!isNow && entry.theme?.color) || entryModule
      ? {
          slug,
          headingFont: (!isNow && entry.theme?.headingFont) || undefined,
          bodyFont: (!isNow && entry.theme?.bodyFont) || undefined,
          monoFont: (!isNow && entry.theme?.monoFont) || undefined,
        }
      : undefined;

  // ── DEMO template: sidebar + canvas, edge-to-edge, no prose article. ──
  if (entry.kind === "demo" && entryModule) {
    // A demo module without a Canvas has nothing to show — the same content→code drift as an
    // unresolvable componentKey, contained the same way.
    if (!Canvas) {
      notFound();
    }
    const demoSurface = (
      // Same last-resort containment as the editorial slots: a scope throw degrades to the
      // unthemed notice instead of blanking the route through its error boundary.
      <EntryScopeBoundary>
        {/* ONE theme-font scope around the whole demo surface — sidebar controls and canvas
            wear the entry's faces together. */}
        <EntryScope seed={scope}>
          <DemoLayout
            title={entry.title ?? "Untitled entry"}
            summary={entry.summary}
            kind={entry.kind}
            stage={entry.stage}
            iterated={entry.iterated}
            seed={entry.themeSeed}
            linkCount={linkCount}
            controls={Sidebar ? <Sidebar slug={slug} /> : null}
          >
            <Canvas slug={slug} />
          </DemoLayout>
        </EntryScope>
      </EntryScopeBoundary>
    );
    return (
      <>
        {pageTheme}
        <Page className={styles.demoPage}>
          {/* The bleed wrapper is the page grid's DIRECT child — it owns the `full` lane
              (an intermediate wrapper like the scope's [data-entry] div would make a lane
              declaration deeper down inert) and stretches the scope + demo to the row's
              height. The provider is a state frame around the whole surface — sidebar
              controls and canvas share it. */}
          <div className={styles.demoBleed}>
            {Provider ? (
              <Provider slug={slug}>{demoSurface}</Provider>
            ) : (
              demoSurface
            )}
          </div>
          <RelatedEntries
            currentId={entry._id}
            related={entry.related}
            backlinks={entry.backlinks}
          />
        </Page>
      </>
    );
  }

  // ── EDITORIAL template: the prose reading column (note · essay · now — and a sketch demo
  //    or unknown kind, which degrade here prose-only). ──
  const article = (
    <ContentGrid asChild>
      <article className={styles.article}>
        <Stack asChild gap={space(3)}>
          <header className={styles.header}>
            <Heading level={1}>{entry.title ?? "Untitled entry"}</Heading>
            {entry.summary ? (
              <Text
                variant="lede"
                color="muted-foreground"
                className={styles.summary}
              >
                {entry.summary}
              </Text>
            ) : null}
            <EntryMeta
              kind={entry.kind}
              stage={entry.stage}
              iterated={entry.iterated}
              seed={entry.themeSeed}
              linkCount={linkCount}
              color="muted-foreground"
            />
          </header>
        </Stack>
        {entry.body ? <EntryBody value={entry.body} scope={scope} /> : null}
      </article>
    </ContentGrid>
  );

  return (
    <>
      {pageTheme}
      <Page>
        {/* The provider is a state frame, not a theme: prose inside stays server-rendered
          editorial content (children pass-through), and the module's interactive surfaces are
          the `slot` blocks interleaved through it — each in its own scoped container. Rendered
          as deep as possible per the bundled composition docs. */}
        {Provider ? <Provider slug={slug}>{article}</Provider> : article}
        <RelatedEntries
          currentId={entry._id}
          related={entry.related}
          backlinks={entry.backlinks}
        />
      </Page>
    </>
  );
}
