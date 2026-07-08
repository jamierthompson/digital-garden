import styles from "./ColorEngineStub.module.css";

/**
 * Placeholder standing in for the Color Engine while it is rebuilt on the new design-system
 * foundation. The heavy demo (cards, rules board, exporters) was removed so the foundation
 * could be rebuilt first without migrating its pre-foundation type literals; the `componentKey`
 * and `embedKey`s stay registered (`src/lib/keys.ts`) so the published entry still resolves.
 * The interactive tool is rebuilt under the template epics — it takes no props (every embed
 * slot resolves to this same placeholder, and the `Experience` slot ignores its `slug`).
 */
export default function ColorEngineStub(): React.ReactElement {
  return (
    <div className={styles.placeholder}>
      <p>The Color Engine is being rebuilt on the new foundation.</p>
    </div>
  );
}
