import styles from "./MissingEmbed.module.css";

interface MissingEmbedProps {
  /** The unresolved `embedKey`, echoed for the editor to spot the drift. */
  embedKey: string;
}

/**
 * The "missing embed" placeholder — the content→code drift backstop for an `embedKey` that
 * no longer resolves in code (renamed/deleted registry entry) [D10, §4.2, D19].
 *
 * Keys have NO referential integrity: a saved `liveEmbed` key may point at code that's gone.
 * The resolver returns a typed `NotFound` rather than crashing the essay, and this is what it
 * renders — a visible, non-fatal notice so the rest of the essay still reads. `role="note"`
 * (not "alert") keeps it informative, not urgent. Var-consuming, themed by the scope (§8).
 */
export default function MissingEmbed({ embedKey }: MissingEmbedProps) {
  return (
    <div className={styles.missing} role="note">
      <p className={styles.label}>Embed unavailable</p>
      <p className={styles.detail}>
        The <code>{embedKey}</code> embed could not be resolved.
      </p>
    </div>
  );
}
