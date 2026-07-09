import { Label } from "radix-ui";

import styles from "./Kicker.module.css";

interface KickerProps {
  readonly children: React.ReactNode;
  /** Set when the kicker labels something referenced by `aria-labelledby`. */
  readonly id?: string;
  /**
   * Set when the kicker labels a form control — it then renders a Radix `Label`
   * (click-to-focus + native semantics) instead of a plain span.
   */
  readonly htmlFor?: string;
}

/**
 * The mono micro-kicker — the site's meta register: uppercase, tracked, muted,
 * monospace. Generic UI primitive (the #120 mono-meta anchor): reads the ambient
 * semantic tokens, so it renders editorial by default and themed inside a themed slot.
 */
export default function Kicker({
  children,
  id,
  htmlFor,
}: KickerProps): React.ReactElement {
  if (htmlFor) {
    return (
      <Label.Root className={styles.kicker} id={id} htmlFor={htmlFor}>
        {children}
      </Label.Root>
    );
  }
  return (
    <span className={styles.kicker} id={id}>
      {children}
    </span>
  );
}
