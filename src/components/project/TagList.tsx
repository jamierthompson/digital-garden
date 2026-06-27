import styles from "./TagList.module.css";

interface TagListProps {
  /** The project's tags, straight from `PROJECT_DETAIL_QUERY` (`string[] | null`). */
  tags: string[] | null;
}

/**
 * The project's tag chips. [§6]
 *
 * A pure, synchronous, var-consuming component (§8, [D2]). Renders **nothing** when there
 * are no tags, so the page shows no empty metadata region. Tags are presentational
 * metadata, not links — there are no tag-archive routes, so linking would dead-end.
 */
export default function TagList({ tags }: TagListProps) {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <section className={styles.tags} aria-label="Tags">
      <ul className={styles.list}>
        {tags.map((tag) => (
          <li key={tag} className={styles.tag}>
            {tag}
          </li>
        ))}
      </ul>
    </section>
  );
}
