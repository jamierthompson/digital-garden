import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";

import { cardSwatches } from "@/lib/cardSwatches";
import { client } from "@/sanity/lib/client";
import { WORK_INDEX_QUERY } from "@/sanity/lib/queries";

import styles from "./page.module.css";

// The `/work` index: a grid of project cards (§4.1). Each card self-themes from its own
// `brandColor` via `cardSwatches` — engine Consumer C, which bakes a few inline `--c-*`
// `light-dark()` literals with NO project scope, no `<style>`, no island [D9, §3.2]. The
// card reads those `--c-*` from its own `style={…}`, so a dozen differently-branded cards
// coexist on one page without a dozen scopes.

/**
 * Fetch the index cards inside a `use cache` boundary so the grid lands in the prerendered
 * static shell (Cache Components / PPR). No request-time APIs are read here, so the cache
 * is keyed only on the query — `cacheLife("max")` because project content changes rarely
 * and is revalidated by tag/deploy, not by time
 * (`node_modules/.../01-directives/use-cache.md`). The query refuses to over-fetch (essay
 * excluded), keeping the index payload small for CWV (§6).
 */
async function getWorkIndex() {
  "use cache";
  const { cacheLife } = await import("next/cache");
  cacheLife("max");
  return client.fetch(WORK_INDEX_QUERY);
}

export const metadata: Metadata = {
  title: "Work",
  description: "Projects in the garden — each its own themed island.",
};

export default async function WorkIndexPage() {
  const projects = await getWorkIndex();

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Work</h1>
      {projects.length === 0 ? (
        <p className={styles.empty}>No projects published yet.</p>
      ) : (
        <ul className={styles.grid}>
          {projects.map((project) => (
            <li
              key={project._id}
              className={styles.card}
              // `cardSwatches` returns a bag of `--c-*` custom properties; cast to
              // `CSSProperties` so they spread onto inline `style` (React types custom
              // props via an index signature a `Record<--c-*, string>` doesn't structurally
              // match on its own).
              style={cardSwatches(project.brandColor) as CSSProperties}
            >
              <Link href={`/work/${project.slug}`} className={styles.cardLink}>
                <h2 className={styles.cardTitle}>{project.title}</h2>
                {project.blurb ? (
                  <p className={styles.cardBlurb}>{project.blurb}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
