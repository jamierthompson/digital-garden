import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EssayBody from "@/components/portable-text/EssayBody";
import ProjectScope from "@/components/project-scope/ProjectScope";
import ProjectScopeBoundary from "@/components/project-scope/ProjectScopeBoundary";
import type { ScopeSeed } from "@/components/project-scope/scopeSeed";
import RelatedEntries from "@/components/project/RelatedEntries";
import { resolveComponentKey } from "@/lib/resolvers/components";
import { isNotFound } from "@/lib/resolvers/resolution";
import type { ProjectModule } from "@/projects/types";
import { client } from "@/sanity/lib/client";
import { ENTRY_SLUGS_QUERY, PROJECT_DETAIL_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

// The flat entry route: every `entry` — any `kind` — lives at a root-level `/[slug]` (this
// dynamic segment cedes precedence to the static routes `/browse`, `/now`, `/about`, `/system`). Thin
// route (`app/` is routing only — it mounts components from `src/`). The composition:
// EDITORIAL page chrome (article prose, related entries) reads the global semantic
// tier; a project's brand color + font are scoped to its interactive slot ONLY:
//   <main> editorial chrome
//     ├ <article> the entry's essay (PT serializer) — editorial
//     ├ ProjectScopeBoundary + ProjectScope + <Experience/> — the brand-themed slot,
//     │   rendered ONLY for a project with a resolvable module
//     └ <RelatedEntries> — editorial (outgoing `related` + incoming backlinks)
//
// Kind-aware: a `project` that DECLARES a `componentKey` must resolve it — a renamed/deleted
// module (drift) → `notFound()`. But a project with NO `componentKey` is a `stage: sketch`
// with no coded module yet (the schema only requires the key past the sketch stage), so it
// renders prose-only, like a note/essay. A note / essay / now is chrome + prose — it has no
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

  // Resolve the coded module by key. A `componentKey` that no longer resolves
  // (renamed/deleted module) degrades a project to not-found, never a crash. A project with
  // NO `componentKey` is a sketch without a coded module yet — it renders prose-only, not a
  // 404. A note/essay/now carries no slot either way, so a missing key is expected there.
  const resolution = entry.componentKey
    ? resolveComponentKey(entry.componentKey)
    : null;
  if (isProject && resolution && isNotFound(resolution)) {
    notFound();
  }

  // Load the module ONLY for a project — a note/essay/now is chrome + prose even
  // if it happens to carry a resolvable `componentKey` (the schema leaves the key optional and
  // un-gated on those kinds). A project has already passed the `notFound()` guard above, so
  // `resolution` is found here; the `isProject` gate keeps runtime matching the documented
  // "only a project has a slot" contract. The module composes one (or both) of two ways:
  // `Experience` = one slot after the prose; `Provider` = a client frame around the article
  // so `liveEmbed` slots interleaved through the prose share state (see `ProjectModule`).
  const projectModule =
    isProject && resolution && !isNotFound(resolution)
      ? ((await resolution.value()) as { default: ProjectModule }).default
      : null;
  const Experience = projectModule?.Experience ?? null;
  const Provider = projectModule?.Provider ?? null;

  // The brand seed, threaded to the body for a project so each `liveEmbed` mounts in its
  // own scoped container. The prose between slots reads the editorial tiers — brand never
  // wraps the article itself.
  const scope: ScopeSeed | undefined = isProject
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
      {entry.body ? <EssayBody value={entry.body} scope={scope} /> : null}
    </article>
  );

  return (
    <main className={styles.module}>
      {/* The provider is a state frame, not a theme: prose inside stays server-rendered
          editorial content (children pass-through). Rendered as deep as possible per the
          bundled composition docs. */}
      {Provider ? <Provider slug={slug}>{article}</Provider> : article}
      {/* Brand is scoped to the interactive slot ONLY — the engine theme wraps
          <Experience/>, not the editorial article/related around it. Rendered only when a
          module resolved (a project); other kinds are prose-only. */}
      {Experience ? (
        <ProjectScopeBoundary>
          <ProjectScope seed={scope}>
            <Experience slug={slug} />
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
