import styles from "./SunriseMeter.module.css";

/**
 * `sunrise-meter` — the one tiny live embed for the `first-light` essay (§4.1, [D15]).
 *
 * Deliberately trivial: a static, self-contained "live" widget that proves the
 * embed-by-key path end-to-end (Portable Text `liveEmbed` block → `resolveEmbedKey`
 * → lazy-mounted component) without any hard interactive logic riding on it — the
 * dead-simple slice's job ([D17]).
 *
 * It is a pure presentational Server Component: no state, no client JS. It reads ONLY
 * the generic scoped tokens (`--brand-*`, `--font-face`, `--space-*`) its CSS Module
 * consumes, so it themes off whatever project scope composes it downward and never
 * reaches up for a host's look (§8, [D2]). A shared embed must theme off the generic
 * layer, never a project-prefixed alias — so this carries no `--logx-*` reads.
 */
export default function SunriseMeter() {
  // A fixed "dawn progress" value — the widget is a static demo, not interactive.
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
