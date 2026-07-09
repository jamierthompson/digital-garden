import styles from "./ColorEngineExperience.module.css";

/**
 * The Color Engine entry's interactive surface, shared by its `Experience` slot and every
 * `liveEmbed` slot (`slots/*`). It takes no props — it ignores `slug` and embed context.
 */
export default function ColorEngineExperience(): React.ReactElement {
  return (
    <div className={styles.placeholder}>
      <p>The Color Engine is being rebuilt on the new foundation.</p>
    </div>
  );
}
