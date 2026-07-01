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
import { PROJECT_DETAIL_QUERY, WORK_INDEX_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

// Thin route (`app/` is routing only — it mounts components from `src/`). The
// composition: EDITORIAL page chrome (article prose, tags, related notes) reads the global
// semantic tier; the doc's brand color + font are scoped to the interactive slot ONLY:
//   <main> editorial chrome
//     ├ <article> the project's essay (PT serializer) + tags — editorial
//     ├ ProjectScopeBoundary (unstable_catchError backstop, client)
//     │   └ ProjectScope (real engine theme from the doc's brandColor/fontKey)
//     │       └ <Experience/> — the bounded, brand-themed interactive island
//     └ <RelatedEntries> — editorial (outgoing `related` + incoming backlinks)
//
// The keystone stays defensive: the scope never throws on a bad brandColor/fontKey.
// The route's OWN failure modes are explicit `notFound()` calls: an unpublished/
// unknown slug, or a `componentKey` that no longer resolves in code.

interface WorkPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Enumerate which slugs to prerender at build (Cache Components extracts each one's static
 * shell). Returning the published set does NOT preclude on-demand rendering of others —
 * under PPR an un-enumerated slug still renders at request time (`generate-static-params.md`).
 *
 * Reads the PUBLISHED `client` directly (not `sanityFetch`): build-time enumeration must
 * prerender the published set, and Draft Mode has no meaning during the build.
 */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  "use cache";
  const { cacheLife } = await import("next/cache");
  cacheLife("max");
  const projects = await client.fetch(WORK_INDEX_QUERY);
  return projects
    .map((p) => p.slug)
    .filter((slug): slug is string => typeof slug === "string")
    .map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: WorkPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await sanityFetch(PROJECT_DETAIL_QUERY, { slug });
  if (!project) {
    return { title: "Not found" };
  }
  const title = project.title ?? "Untitled project";
  const description = project.blurb ?? undefined;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
  };
}

export default async function WorkPage({ params }: WorkPageProps) {
  // Request API is async under Next 16 — `params` is a Promise, awaited before use.
  const { slug } = await params;
  const project = await sanityFetch(PROJECT_DETAIL_QUERY, { slug });

  // Unpublished / unknown slug → the not-found boundary.
  if (!project) {
    notFound();
  }

  // Resolve the coded module by key. A `componentKey` that no longer resolves (renamed/
  // deleted module) degrades to not-found, never a crash.
  const resolution = project.componentKey
    ? resolveComponentKey(project.componentKey)
    : null;
  if (!resolution || isNotFound(resolution)) {
    notFound();
  }

  const mod = (await resolution.value()) as { default: ProjectModule };
  const { Experience } = mod.default;

  return (
    <main className={styles.module}>
      <article className={styles.article}>
        <header className={styles.header}>
          <h1 className={styles.title}>{project.title}</h1>
          {project.blurb ? (
            <p className={styles.blurb}>{project.blurb}</p>
          ) : null}
          {/* Tags + related entries render the detail query's `tags` / `related[]->`
              + `backlinks` projections (each self-guards to null when empty), so the
              query no longer over-fetches fields nothing renders. */}
          <TagList tags={project.tags} />
        </header>
        {project.body ? <EssayBody value={project.body} /> : null}
      </article>
      {/* Brand is scoped to the interactive slot ONLY — the engine theme wraps
          <Experience/>, not the editorial article/related-notes around it. */}
      <ProjectScopeBoundary>
        <ProjectScope
          seed={{
            slug,
            brandColor: project.brandColor ?? "",
            fontKey: project.fontKey ?? "",
          }}
        >
          <Experience />
        </ProjectScope>
      </ProjectScopeBoundary>
      <RelatedEntries
        currentId={project._id}
        related={project.related}
        backlinks={project.backlinks}
      />
    </main>
  );
}
