// Live component preview (#106) for ONE scheme. The container re-binds the semantic tokens to
// this scheme's GENERATED palette (tokensToScopeVars) and sets `color-scheme`; every specimen
// inside reads the standard semantic tokens, so it paints the generated palette without ever
// re-deriving color. Specimens are visual only (non-interactive) — a demo of the palette on
// real component shapes, not working controls. Re-themes live because its tokens are props.

import type { Scheme, SchemeTokens } from "@garden/oklch";

import { tokensToScopeVars } from "../core/scope";
import styles from "./PreviewPanel.module.css";

interface PreviewPanelProps {
  readonly scheme: Scheme;
  readonly tokens: SchemeTokens;
}

const STATUS: readonly { token: string; label: string }[] = [
  { token: "success", label: "Saved" },
  { token: "error", label: "Failed" },
  { token: "warning", label: "Review" },
  { token: "info", label: "Syncing" },
];

export default function PreviewPanel({
  scheme,
  tokens,
}: PreviewPanelProps): React.ReactElement {
  return (
    <div
      className={styles.panel}
      style={{ ...tokensToScopeVars(tokens), colorScheme: scheme }}
      role="group"
      aria-label={`${scheme} preview`}
    >
      <span className={styles.schemeLabel}>{scheme}</span>

      <div className={styles.card}>
        <h4 className={styles.cardTitle}>A card on this palette</h4>
        <p className={styles.body}>
          Body text sits on the elevated surface.{" "}
          <a className={styles.link}>An accent link</a> carries the brand.
        </p>
        <p className={styles.muted}>Muted secondary line — still legible.</p>
      </div>

      <div className={styles.controls}>
        <span className={styles.button}>Primary</span>
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
              color: `var(--${s.token})`,
              borderColor: `var(--${s.token})`,
            }}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
