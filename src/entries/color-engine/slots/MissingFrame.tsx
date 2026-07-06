import styles from "./slots.module.css";

/**
 * Rendered when a Color Engine slot is authored into a body with no `ColorEngineProvider` above it
 * (the Color Engine's slots are `liveEmbed`s — any entry CAN reference one). Visible and honest,
 * like `MissingEmbed`: the essay keeps rendering, the slot says why it can't.
 */
export default function MissingFrame({
  name,
}: {
  readonly name: string;
}): React.ReactElement {
  return (
    <p role="note" className={styles.missing}>
      The {name} panel renders inside the Color Engine entry — this page has no
      Color Engine frame mounted.
    </p>
  );
}
