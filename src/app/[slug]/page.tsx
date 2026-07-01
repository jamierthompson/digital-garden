import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EssayBody from "@/components/portable-text/EssayBody";
import ProjectScope from "@/components/project-scope/ProjectScope";
import ProjectScopeBoundary from "@/components/project-scope/ProjectScopeBoundary";
import RelatedEntries from "@/components/project/RelatedEntries";
import TagList from "@/components/project/TagList";
import { resolveComponentKey } from "@/lib/resolvers/components";
import { isNotFound } from "@/lib/resolvers/resolution";
import type { ProjectModule } from "@/projects/types";
import { client } from "@/sanity/lib/client";
import { ENTRY_SLUGS_QUERY, PROJECT_DETAIL_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

// The flat entry route: every `entry` — any `kind` — lives at a root-level `/[slug]` (this
// dynamic segment cedes precedence to the static routes `/browse`, `/now`, `/about`). Thin
// route (`app/` is routing only — it mounts components from `src/`). The composition:
// EDITORIAL page chrome (article prose, tags, related entries) reads the global semantic
// tier; a project's brand color + font are scoped to its interactive slot ONLY:
//   <main> editorial chrome
//     ├ <article> the entry's essay (PT serializer) + tags — editorial
//     ├ ProjectScopeBoundary + ProjectScope + <Experience/> — the brand-themed slot,
//     │   rendered ONLY for a project with a resolvable module
//     └ <RelatedEntries> — editorial (outgoing `related` + incoming backlinks)
//
// Kind-aware: a `project` REQUIRES a coded module (a `componentKey` that resolves), so a
// missing/renamed key → `notFound()`. A note / essay / now is chrome + prose — it has no
// interactive slot, so it renders without a scope. The keystone stays defensive: the scope
// never throws on a bad brandColor/fontKey.

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
  const entry = await sanityFetch(PROJECT_DETAIL_QUERY, { slug });
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
  const entry = await sanityFetch(PROJECT_DETAIL_QUERY, { slug });

  // Unpublished / unknown slug → the not-found boundary.
  if (!entry) {
    notFound();
  }

  const isProject = entry.kind === "project";

  // Resolve the coded module by key. Only a PROJECT requires one: a `componentKey` that no
  // longer resolves (renamed/deleted module) degrades a project to not-found, never a crash.
  // A note/essay/now carries no slot, so a missing key is expected, not an error.
  const resolution = entry.componentKey
    ? resolveComponentKey(entry.componentKey)
    : null;
  if (isProject && (!resolution || isNotFound(resolution))) {
    notFound();
  }

  const Experience =
    resolution && !isNotFound(resolution)
      ? ((await resolution.value()) as { default: ProjectModule }).default
          .Experience
      : null;

  return (
    <main className={styles.module}>
      <article className={styles.article}>
        <header className={styles.header}>
          <h1 className={styles.title}>{entry.title}</h1>
          {entry.blurb ? <p className={styles.blurb}>{entry.blurb}</p> : null}
          {/* Tags + related entries render the detail query's `tags` / `related[]->`
              + `backlinks` projections (each self-guards to null when empty). */}
          <TagList tags={entry.tags} />
        </header>
        {entry.body ? <EssayBody value={entry.body} /> : null}
      </article>
      {/* Brand is scoped to the interactive slot ONLY — the engine theme wraps
          <Experience/>, not the editorial article/related around it. Rendered only when a
          module resolved (a project); other kinds are prose-only. */}
      {Experience ? (
        <ProjectScopeBoundary>
          <ProjectScope
            seed={{
              slug,
              brandColor: entry.brandColor ?? "",
              fontKey: entry.fontKey ?? "",
            }}
          >
            <Experience />
          </ProjectScope>
        </ProjectScopeBoundary>
      ) : null}
      <RelatedEntries
        currentId={entry._id}
        related={entry.related}
        backlinks={entry.backlinks}
      />
    </main>
  );
}
