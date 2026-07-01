import type { Metadata } from "next";
import Link from "next/link";

import { cardSwatches } from "@/lib/cardSwatches";
import { WORK_INDEX_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

// The `/work` index: a grid of editorial-chrome cards. Each card carries a single decorative
// brand accent from its own `brandColor` via `cardSwatches` — engine Consumer C, which bakes a
// `light-dark()` `borderTopColor` inline (a real CSS property, NOT a project-prefixed
// custom-property token), with no project scope, no `<style>`, no island. So a dozen
// differently-accented cards coexist on one page without a dozen scopes; the card's
// surface/border/text stay editorial (accessible).

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
              // `cardSwatches` returns a plain `{ borderTopColor }` style — a real CSS
              // property, so it spreads straight onto inline `style` (no cast, no token).
              style={cardSwatches(project.brandColor)}
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
