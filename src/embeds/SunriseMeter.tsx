import styles from "./SunriseMeter.module.css";

/**
 * `sunrise-meter` — the one tiny live embed for the `first-light` essay (§4.1, [D15]). A
 * static widget that proves the embed-by-key path end-to-end (Portable Text `liveEmbed`
 * block → `resolveEmbedKey` → lazy-mounted component) [D17].
 *
 * A pure presentational Server Component reading ONLY generic scoped tokens, so it themes
 * off whatever project scope composes it downward (§8, [D2]). A shared embed must theme off
 * the generic layer, never a project-prefixed alias — so this carries no `--logx-*` reads.
 */
export default function SunriseMeter() {
  const progress = 0.62;
  const pct = Math.round(progress * 100);
  return (
    <figure className={styles.meter} aria-label={`Dawn progress: ${pct}%`}>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ inlineSize: `${pct}%` }}
          role="presentation"
        />
      </div>
      <figcaption className={styles.caption}>
        Sunrise meter — {pct}% to full light
      </figcaption>
    </figure>
  );
}
