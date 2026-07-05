// Live component preview (#106) — the generated palette on real component shapes (a card,
// controls, status badges). It reads the STANDARD semantic tokens and inherits them from its
// slot, which re-binds them to the generated palette as `light-dark()` literals — so every
// specimen paints the generated palette AND follows the browser's resolved scheme at first
// paint (flash-free), never a JS-resolved one. Specimens are visual only (non-interactive).
//
// Scheme-agnostic by construction: it sets no `color-scheme` (inherits, #159) and carries no
// scheme in its accessible name (the single-scheme studio's scheme is the viewer's, resolved
// by CSS) — so there is no light-first lie and nothing to correct on the client.

import styles from "./PreviewCard.module.css";

export default function PreviewCard(): React.ReactElement {
  return (
    <div className={styles.root} role="group" aria-label="palette preview">
      <div className={styles.card}>
        <p className={styles.cardTitle}>A card on this palette</p>
        <p className={styles.body}>
          Body text sits on the elevated surface.{" "}
          <a className={styles.link}>An accent link</a> carries the brand.
        </p>
        <p className={styles.muted}>Muted secondary line — still legible.</p>
      </div>

      <div className={styles.controls}>
        <span className={styles.button}>Primary</span>
        {/* Static hover specimen — no real pointer, so the hover treatment is baked in as its
            own class (same trick as `.focusInput` below: show the state, don't require it). */}
        <span className={styles.buttonHover}>Hover</span>
        <span className={styles.chip}>chip</span>
        <span className={styles.input}>input field</span>
        <span className={styles.focusInput}>focused</span>
      </div>

      <div className={styles.badges}>
        {STATUS.map((s) => (
          <span
            key={s.token}
            className={styles.badge}
            style={{
              // The text-legible status token (4.5:1) for the label; the fill (3:1 UI) for the
              // outline — the two are distinct tokens in the 34-token model (#160).
              color: `var(--${s.token}-text)`,
              borderColor: `var(--${s.token})`,
            }}
          >
            {s.label}
          </span>
        ))}
      </div>

      <div className={styles.alert}>
        <p className={styles.alertText}>
          Heads up — this alert sits on the soft error container, not the
          saturated fill.
        </p>
      </div>

      <ul className={styles.rows}>
        <li className={styles.row}>A resting row</li>
        <li className={styles.rowHover}>Hovered row</li>
        <li className={styles.rowSelected}>Selected row</li>
      </ul>

      <div className={styles.scrimDemo}>
        <div className={styles.scrimDialog}>Dialog</div>
      </div>
    </div>
  );
}

const STATUS: readonly { token: string; label: string }[] = [
  { token: "success", label: "Saved" },
  { token: "error", label: "Failed" },
  { token: "warning", label: "Review" },
  { token: "info", label: "Syncing" },
];
