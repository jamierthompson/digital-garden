import styles from "./experience.module.css";

/**
 * The `first-light` interactive experience — the one constant a project module always has
 * (§4.1). A thin page mounts this component [D20]. For the dead-simple slice it is
 * deliberately trivial: a static, self-contained panel that proves the experience seam
 * (module → thin page → route) without any hard logic riding on it (§Phase 3, [D17]).
 *
 * No headless `core/` here — the deferral discipline says don't carve one until an
 * experience's logic earns it, and a static panel does not [D20, D24]. It is a pure
 * presentational Server Component reading only generic scoped tokens, so it themes off
 * whatever scope composes it downward and never reaches up for a look (§8).
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
