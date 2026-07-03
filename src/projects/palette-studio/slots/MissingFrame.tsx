import styles from "./slots.module.css";

/**
 * Rendered when a studio slot is authored into a body with no `StudioProvider` above it
 * (the studio's slots are `liveEmbed`s — any entry CAN reference one). Visible and honest,
 * like `MissingEmbed`: the essay keeps rendering, the slot says why it can't.
 */
export default function MissingFrame({
  name,
}: {
  readonly name: string;
}): React.ReactElement {
  return (
    <p role="note" className={styles.missing}>
      The {name} panel renders inside the Palette Studio entry — this page has
      no studio frame mounted.
    </p>
  );
}
