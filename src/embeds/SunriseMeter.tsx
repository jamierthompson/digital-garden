import styles from "./SunriseMeter.module.css";

/**
 * `sunrise-meter` — a small static in-essay live embed. The one worked example that proves
 * the embed-by-key path end-to-end (Portable Text `liveEmbed` block → `resolveEmbedKey` →
 * lazy-mounted component), kept as the reference for future essay embeds.
 *
 * A pure presentational Server Component reading ONLY generic scoped tokens, so it themes
 * off whatever project scope composes it downward. A shared embed must theme off
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
