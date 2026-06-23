import type { ReactNode } from "react";

import styles from "./ModuleShell.module.css";

interface ModuleShellProps {
  slug: string;
  /** The streamed (suspended) slot — see `StreamedSection`. */
  children: ReactNode;
}

// The one HARDCODED module shell for the walking skeleton. It is pure presentation: it
// reads only generic tokens (`--brand-*`, `--font-face`, `--space-*`) via its CSS Module,
// never reaching up for a host's look (§8). Phase 3 replaces this with a real, Sanity-fed
// project module.
export default function ModuleShell({ slug, children }: ModuleShellProps) {
  return (
    <main className={styles.module}>
      <h1 className={styles.title}>Walking Skeleton</h1>
      <p className={styles.lede}>
        Hardcoded module <code>{slug}</code>, themed through the stub{" "}
        <code>ProjectScope</code>. Brand colour and font come entirely from the
        scoped <code>@layer brand</code> block in <code>&lt;head&gt;</code>.
      </p>
      <span className={styles.badge}>brand accent on contrast</span>
      <p>
        <a className={styles.cta} href={`/work/${slug}`}>
          A focusable link (engine focus-ring token)
        </a>
      </p>
      {children}
    </main>
  );
}
