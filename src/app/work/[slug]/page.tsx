import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EssayBody from "@/components/portable-text/EssayBody";
import ProjectScope from "@/components/project-scope/ProjectScope";
import ProjectScopeBoundary from "@/components/project-scope/ProjectScopeBoundary";
import { resolveComponentKey } from "@/lib/resolvers/components";
import { isNotFound } from "@/lib/resolvers/resolution";
import type { ProjectModule } from "@/projects/types";
import { client } from "@/sanity/lib/client";
import { PROJECT_DETAIL_QUERY, WORK_INDEX_QUERY } from "@/sanity/lib/queries";

import styles from "./page.module.css";

// Thin route (`app/` is routing only — it mounts components from `src/`). The Phase-3
// composition, replacing the walking-skeleton seed with real Sanity-driven theming:
//   ProjectScopeBoundary (unstable_catchError backstop, client)        [D9]
//     └ ProjectScope (real engine theme from the doc's brandColor/fontKey)
//         └ <article> the project's essay (PT serializer) + its experience module
//
// The keystone stays defensive: the scope never throws on a bad brandColor/fontKey [D9].
// The route's OWN failure modes are explicit `notFound()` calls [D10, D19]: an unpublished/
// unknown slug, or a `componentKey` that no longer resolves in code.

interface WorkPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Fetch one project by slug inside a `use cache` boundary so the themed shell lands in the
 * prerendered static HTML (Cache Components / PPR, [D11]). `params` is read by the caller
 * and the slug passed in as an argument — request-time values must NOT be read inside a
 * `use cache` function (`node_modules/.../01-directives/use-cache.md`). `cacheLife("max")`:
 * project content changes rarely, revalidated by tag/deploy.
 */
async function getProject(slug: string) {
  "use cache";
  const { cacheLife } = await import("next/cache");
  cacheLife("max");
  return client.fetch(PROJECT_DETAIL_QUERY, { slug });
}

/**
 * Enumerate which slugs to prerender at build (Cache Components extracts each one's static
 * shell). Returning the published set does NOT preclude on-demand rendering of others —
 * under PPR an un-enumerated slug still renders at request time (`generate-static-params.md`).
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
  const project = await getProject(slug);
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
  // Request API is async under Next 16 — `params` is a Promise, awaited here (outside the
  // cached fetch, then passed in).
  const { slug } = await params;
  const project = await getProject(slug);

  // Unpublished / unknown slug → the not-found boundary [D10, D19].
  if (!project) {
    notFound();
  }

  // Resolve the coded module by key. A `componentKey` that no longer resolves (renamed/
  // deleted module) degrades to not-found, never a crash [D10].
  const resolution = project.componentKey
    ? resolveComponentKey(project.componentKey)
    : null;
  if (!resolution || isNotFound(resolution)) {
    notFound();
  }

  const mod = (await resolution.value()) as { default: ProjectModule };
  const { Experience } = mod.default;

  return (
    <ProjectScopeBoundary>
      <ProjectScope
        seed={{
          slug,
          brandColor: project.brandColor ?? "",
          fontKey: project.fontKey ?? "",
        }}
      >
        <main className={styles.module}>
          <article className={styles.article}>
            <header className={styles.header}>
              <h1 className={styles.title}>{project.title}</h1>
              {project.blurb ? (
                <p className={styles.blurb}>{project.blurb}</p>
              ) : null}
            </header>
            {project.essay ? <EssayBody value={project.essay} /> : null}
          </article>
          <Experience />
        </main>
      </ProjectScope>
    </ProjectScopeBoundary>
  );
}
