import type { Metadata } from "next";
import Link from "next/link";

import { INDEX_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Index",
  description:
    "Every entry in the garden — projects, essays, and now-updates, browsable in one place.",
};

// The kinds in display order, with their section labels. A named constant so the order and
// wording live in one place, not as magic strings scattered through the render.
//
// `note` is deliberately absent: notes are excluded from the Index surface (a UI decision) —
// they remain first-class content, still reachable at their flat `/[slug]` and through
// backlinks, just not listed here. The INDEX_QUERY still returns them (they're simply not
// rendered), so this stays a pure presentation filter, not a data-model change.
const KIND_SECTIONS = [
  { kind: "project", label: "Projects" },
  { kind: "essay", label: "Essays" },
  { kind: "now", label: "Now" },
] as const;

/**
 * The `/browse` route (labelled "index" in the nav) — the browsable list of every entry, the wanderer's reading path
 * (the featured home `/` is the hurried evaluator's). Shell-owned editorial chrome: it reads
 * the global semantic tokens, with NO per-entry brand (a project's brand lives on its own
 * detail slot, not here). Groups entries by `kind` (notes excluded — see `KIND_SECTIONS`),
 * shows the `stage` maturity badge and a backlink hint, and links each to its flat `/[slug]`.
 */
export default async function IndexPage() {
  const entries = await sanityFetch(INDEX_QUERY);

  // Empty-state guard keys off the RENDERED set, not the fetched set: notes are excluded from
  // KIND_SECTIONS, so `entries` can be non-empty yet nothing indexable renders (e.g. a garden
  // that is only notes). Guarding on the fetched length would strand the reader on a bare
  // header — so guard on whether any entry belongs to a rendered kind.
  const hasVisibleEntries = entries.some((entry) =>
    KIND_SECTIONS.some((section) => section.kind === entry.kind),
  );

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Index</h1>
        <p className={styles.intro}>
          Everything in the garden — projects, essays, and now-updates.
        </p>
      </header>
      {!hasVisibleEntries ? (
        <p className={styles.empty}>Nothing published yet.</p>
      ) : (
        KIND_SECTIONS.map(({ kind, label }) => {
          const inKind = entries.filter((entry) => entry.kind === kind);
          if (inKind.length === 0) return null;
          return (
            <section
              key={kind}
              className={styles.section}
              aria-labelledby={`section-${kind}`}
            >
              <h2 id={`section-${kind}`} className={styles.sectionHeading}>
                {label}
              </h2>
              <ul className={styles.list}>
                {inKind.map((entry) => (
                  <li key={entry._id} className={styles.item}>
                    <div className={styles.itemHead}>
                      {entry.slug ? (
                        <Link
                          href={`/${entry.slug}`}
                          className={styles.itemLink}
                        >
                          {entry.title ?? "Untitled entry"}
                        </Link>
                      ) : (
                        <span className={styles.itemLink}>
                          {entry.title ?? "Untitled entry"}
                        </span>
                      )}
                      {entry.stage ? (
                        <span className={styles.stage} data-stage={entry.stage}>
                          {entry.stage}
                        </span>
                      ) : null}
                    </div>
                    {entry.blurb ? (
                      <p className={styles.blurb}>{entry.blurb}</p>
                    ) : null}
                    {(entry.linkCount ?? 0) > 0 ? (
                      <span className={styles.meta}>
                        {entry.linkCount} linked
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}
