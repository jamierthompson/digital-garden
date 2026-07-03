import type { ExperienceProps } from "@/projects/types";

import styles from "./experience.module.css";

/**
 * The `first-light` interactive experience — the one constant a project module always has;
 * a thin page mounts it. A pure presentational Server Component reading only
 * generic scoped tokens, so it themes off whatever scope composes it downward and never
 * reaches up for a look. No headless `core/` — don't carve one until logic earns it,
 * and a static panel does not (instantiate on genuine need, not before).
 */
export default function FirstLightExperience({ slug }: ExperienceProps) {
  // `slug`-scoped, not a literal: two Activity-preserved `/[slug]` routes rendering this
  // same component would otherwise collide on a hardcoded id (see `ExperienceProps.slug`).
  const headingId = `experience-heading-${slug}`;

  return (
    <section className={styles.experience} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        The experience
      </h2>
      <p className={styles.body}>
        A quiet panel that brightens with the dawn — the trivial interactive
        surface this first slice exists to prove, themed entirely by the project
        scope around it.
      </p>
    </section>
  );
}
