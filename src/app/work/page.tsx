import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";

import { cardSwatches } from "@/lib/cardSwatches";
import { WORK_INDEX_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

// The `/work` index: a grid of self-branded cards. Each card re-binds the generic semantic
// tokens inline from its own `brandColor` via `cardSwatches` — engine Consumer C, which bakes
// `light-dark()` overrides of `--surface`/`--text`/`--border`/`--accent` (generic names, NO
// project-prefixed token), spread onto the card's `style`, with no project scope, no `<style>`,
// no island. So a dozen differently-branded cards coexist on one page without a dozen scopes,
// and the grid doubles as the engine's live contrast stress-test (surface↔text is the solved
// pair, exercised at every brand value).

export const metadata: Metadata = {
  title: "Work",
  description: "Projects in the garden — each its own themed island.",
};

export default async function WorkIndexPage() {
  // `sanityFetch` caches the published read into the static shell and transparently
  // serves fresh drafts under Draft Mode. The index query refuses to
  // over-fetch (essay excluded), keeping the payload small for CWV.
  const projects = await sanityFetch(WORK_INDEX_QUERY);

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
              // `cardSwatches` returns generic semantic-token overrides (`--surface`, …)
              // baked as `light-dark()` literals; spread inline they re-bind this card's
              // subtree to its own engine-solved brand palette. Cast to `CSSProperties`:
              // React types custom props via an index signature a `Record<--*, string>`
              // doesn't structurally match on its own.
              style={cardSwatches(project.brandColor) as CSSProperties}
            >
              <Link href={`/${project.slug}`} className={styles.cardLink}>
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
