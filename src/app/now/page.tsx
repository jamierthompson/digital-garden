import type { Metadata } from "next";
import Link from "next/link";

import { NOW_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Now",
  description:
    "What I'm focused on at the moment — a dated stream, in the spirit of nownownow.com.",
  openGraph: {
    title: "Now",
    description:
      "What I'm focused on at the moment — a dated stream, in the spirit of nownownow.com.",
    type: "website",
  },
};

// Format an authored `iterated` date (an ISO `YYYY-MM-DD` from Sanity's `date` field) into a
// readable stamp. Pinned to UTC so the server-rendered string is stable regardless of the
// deploy region's timezone.
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The `/now` page (after nownownow.com) — now Sanity-driven: a reverse-chronological stream of
 * `kind == "now"` entries, newest first. Shell-owned editorial chrome (global semantic tokens,
 * no brand scope). Each update links to its own flat `/[slug]` for the full text, and the same
 * updates fold into the Index's "Now" section.
 */
export default async function NowPage() {
  const updates = await sanityFetch(NOW_QUERY);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Now</h1>
        <p className={styles.intro}>
          What I&apos;m focused on at the moment. Newest first.
        </p>
      </header>

      {updates.length === 0 ? (
        <p className={styles.empty}>No now-updates yet — check back soon.</p>
      ) : (
        <ul className={styles.list}>
          {updates.map((update) => {
            const date = formatDate(update.iterated);
            return (
              <li key={update._id} className={styles.item}>
                {date ? (
                  <time
                    className={styles.date}
                    dateTime={update.iterated ?? undefined}
                  >
                    {date}
                  </time>
                ) : null}
                {update.slug ? (
                  <Link href={`/${update.slug}`} className={styles.itemTitle}>
                    {update.title ?? "Untitled update"}
                  </Link>
                ) : (
                  <span className={styles.itemTitle}>
                    {update.title ?? "Untitled update"}
                  </span>
                )}
                {update.blurb ? (
                  <p className={styles.blurb}>{update.blurb}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.footnote}>
        This is a{" "}
        <a
          className={styles.link}
          href="https://nownownow.com/about"
          rel="noopener noreferrer"
        >
          now page
        </a>
        , and you could make one too.
      </p>
    </main>
  );
}
