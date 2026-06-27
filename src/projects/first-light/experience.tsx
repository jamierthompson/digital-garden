import styles from "./experience.module.css";

/**
 * The `first-light` interactive experience — the one constant a project module always has
 * (§4.1); a thin page mounts it [D20]. A pure presentational Server Component reading only
 * generic scoped tokens, so it themes off whatever scope composes it downward and never
 * reaches up for a look (§8). No headless `core/` — don't carve one until logic earns it,
 * and a static panel does not [D20, D24].
 */
export default function FirstLightExperience() {
  return (
    <section className={styles.experience} aria-labelledby="experience-heading">
      <h2 id="experience-heading" className={styles.heading}>
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
