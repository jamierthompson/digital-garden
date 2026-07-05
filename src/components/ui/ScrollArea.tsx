"use client";

// Harvested from `feat/entry-slide-over` (the slide-over/canvas exploration whose routing
// mechanism was rejected, #139/#154) — the component itself is generic shell chrome, unrelated
// to that branch's routing approach. First real consumer: the palette-studio CANVAS template's
// `StudioCanvas` (#139 kind-driven canvas), so its scrollbar thumb picks up the entry's brand
// `--accent` for free.

import { ScrollArea as RadixScrollArea } from "radix-ui";
import type { ReactNode } from "react";

import styles from "./ScrollArea.module.css";

interface ScrollAreaProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * The shared scroll container: Radix ScrollArea with the site's semantic scrollbar.
 * The thumb reads `--accent`, so inside a brand scope (`[data-entry]`) the scrollbar
 * is automatically the entry's brand color — no per-use wiring; outside a scope it's
 * the editorial accent. Fills its parent (parent controls the size; give it a bounded
 * block-size and `min-block-size: 0` in grid/flex cells).
 *
 * `type="always"` — the one deviation from the harvested `feat/entry-slide-over` version,
 * whose Root left `type` at Radix's own default (`"hover"`: the Scrollbar/Thumb don't even
 * mount until a real pointer hover, confirmed against the installed
 * `@radix-ui/react-scroll-area@1.2.13` source). The thumb IS the brand color here, so hiding
 * it until a hover would hide the very thing this component exists to show off — "always"
 * keeps it mounted and visible from first paint.
 */
export default function ScrollArea({
  children,
  className,
}: ScrollAreaProps): ReactNode {
  return (
    <RadixScrollArea.Root
      type="always"
      className={className ? `${styles.root} ${className}` : styles.root}
    >
      <RadixScrollArea.Viewport className={styles.viewport}>
        {children}
      </RadixScrollArea.Viewport>
      <RadixScrollArea.Scrollbar
        orientation="vertical"
        className={styles.scrollbar}
      >
        <RadixScrollArea.Thumb className={styles.thumb} />
      </RadixScrollArea.Scrollbar>
      <RadixScrollArea.Scrollbar
        orientation="horizontal"
        className={styles.scrollbar}
      >
        <RadixScrollArea.Thumb className={styles.thumb} />
      </RadixScrollArea.Scrollbar>
      <RadixScrollArea.Corner />
    </RadixScrollArea.Root>
  );
}
