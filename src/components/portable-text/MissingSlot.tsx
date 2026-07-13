import Text from "@/components/typography/Text";

import styles from "./MissingSlot.module.css";

interface MissingSlotProps {
  /** The unresolved `slotKey`, echoed for the editor to spot the drift. */
  slotKey: string;
}

/**
 * The "missing slot" placeholder — the content→code drift backstop for a `slotKey` that
 * no longer resolves in code (renamed/deleted registry entry).
 *
 * Keys have NO referential integrity: a saved `slot` key may point at code that's gone.
 * The resolver returns a typed `NotFound` rather than crashing the essay, and this is what it
 * renders — a visible, non-fatal notice so the rest of the essay still reads. `role="note"`
 * (not "alert") keeps it informative, not urgent. Var-consuming, themed by the scope.
 */
export default function MissingSlot({ slotKey }: MissingSlotProps) {
  return (
    <div className={styles.missing} role="note">
      <Text variant="label" className={styles.label}>
        Slot unavailable
      </Text>
      <Text variant="caption" className={styles.detail}>
        The <code>{slotKey}</code> slot could not be resolved.
      </Text>
    </div>
  );
}
