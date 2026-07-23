import type { ReactNode } from "react";

import EntryMeta from "@/components/entry/EntryMeta";
import EntryTeaser from "@/components/entry/EntryTeaser";
import Stack from "@/components/layout/Stack";
import { space } from "@/lib/tokens";

import styles from "./DemoLayout.module.css";

interface DemoLayoutProps {
  /** The display title — already fallback-resolved by the caller (`?? "Untitled …"`). */
  readonly title: string;
  readonly summary?: string | null;
  readonly kind?: string | null;
  readonly stage?: string | null;
  /** The authored last-tended date (ISO `YYYY-MM-DD`), for the meta readout. */
  readonly tended?: string | null;
  /** The resolved OKLCH seed readout (the same fact the featured cards print). */
  readonly seed?: string | null;
  /** Backlink hint — rendered only when positive. */
  readonly linkCount?: number | null;
  /** The module's sidebar controls, already rendered — mounted below the entry info. */
  readonly controls?: ReactNode;
  /** The module-owned canvas surface. */
  readonly children: ReactNode;
}

/**
 * The demo template's two-region layout — a page-owned sidebar (the entry's info, then the
 * module's controls) beside the module-owned canvas, edge-to-edge in the content grid's `full`
 * lane. The regions are an intrinsic sidebar pattern (flex + wrap, no `@media`): the canvas
 * takes all spare width and the pair stacks on its own when the viewport is tight. Hybrid
 * ownership: the PAGE renders the entry info here (DRY across demos); the MODULE contributes
 * `controls` and the canvas `children`.
 */
export default function DemoLayout({
  title,
  summary,
  kind,
  stage,
  tended,
  seed,
  linkCount,
  controls,
  children,
}: DemoLayoutProps): React.ReactElement {
  return (
    <section className={styles.demo}>
      <div className={styles.sidebar}>
        <Stack asChild gap={space(4)}>
          <header>
            {/* A demo has no body, so its summary IS its prose — the fused teaser is the header.
                The summary is teaser body text, NOT a lede: the atom renders it as `body`, never
                the `lede` role. No slug: this IS the demo's page, so the title is plain text. */}
            <EntryTeaser title={title} summary={summary} level={1} />
            <EntryMeta
              kind={kind}
              stage={stage}
              tended={tended}
              seed={seed}
              linkCount={linkCount}
              color="muted-foreground"
            />
          </header>
        </Stack>
        {controls ? <div className={styles.controls}>{controls}</div> : null}
      </div>
      <div className={styles.canvas}>{children}</div>
    </section>
  );
}
