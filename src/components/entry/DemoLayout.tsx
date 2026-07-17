import type { ReactNode } from "react";

import Stack from "@/components/layout/Stack";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import { space } from "@/lib/tokens";

import styles from "./DemoLayout.module.css";

interface DemoLayoutProps {
  /** The display title — already fallback-resolved by the caller (`?? "Untitled …"`). */
  readonly title: string;
  readonly summary?: string | null;
  /** The kind label for the mono readout (always "demo" today; the page passes what it has). */
  readonly kind?: string | null;
  readonly stage?: string | null;
  /** The last-iterated stamp — the machine value for `<time>` plus its display label. */
  readonly iterated?: {
    readonly dateTime: string;
    readonly label: string;
  } | null;
  /** The resolved OKLCH seed readout (the same fact the featured cards print). */
  readonly seed?: string | null;
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
  iterated,
  seed,
  controls,
  children,
}: DemoLayoutProps): React.ReactElement {
  const kindStage = [kind, stage].filter(Boolean).join(" · ");
  return (
    <section className={styles.demo}>
      <div className={styles.sidebar}>
        <Stack asChild gap={space(4)}>
          <header>
            <Heading level={1} color="accent-text">
              {title}
            </Heading>
            {summary ? (
              <Text variant="lede" color="muted-foreground">
                {summary}
              </Text>
            ) : null}
            {/* The mono readout — each fact renders only when present. */}
            <Stack gap={space(1)}>
              {kindStage ? (
                <Text variant="meta" color="muted-foreground">
                  {kindStage}
                </Text>
              ) : null}
              {iterated ? (
                <Text variant="meta" color="muted-foreground" asChild>
                  <time dateTime={iterated.dateTime}>
                    iterated {iterated.label}
                  </time>
                </Text>
              ) : null}
              {seed ? (
                <Text variant="meta" color="muted-foreground">
                  {seed}
                </Text>
              ) : null}
            </Stack>
          </header>
        </Stack>
        {controls ? <div className={styles.controls}>{controls}</div> : null}
      </div>
      <div className={styles.canvas}>{children}</div>
    </section>
  );
}
