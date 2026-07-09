"use client";

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
 * `type="always"` overrides Radix's default (`"hover"`, which doesn't mount the Scrollbar/Thumb
 * until a real pointer hover — confirmed against the installed `@radix-ui/react-scroll-area@1.2.13`
 * source). The thumb IS the brand color here, so hiding it until hover would hide the very thing
 * this component exists to show off — "always" keeps it mounted and visible from first paint.
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
      {/* VERTICAL ONLY — no horizontal Scrollbar + no Corner (owner: the vertical track must run
          flush to the bottom edge). Radix insets the vertical scrollbar by `bottom:
          var(--radix-scroll-area-corner-height)` — the horizontal scrollbar's reserved corner —
          so an always-mounted (`type="always"`) horizontal bar stops the vertical thumb ~10px
          short of the bottom even when the surface never scrolls sideways. A consumer that has
          genuinely wide children should scroll them INTERNALLY (`overflow-x: auto`). Dropping the
          horizontal bar removes the corner reservation, so the vertical track spans the full
          height. */}
      <RadixScrollArea.Scrollbar
        orientation="vertical"
        className={styles.scrollbar}
      >
        <RadixScrollArea.Thumb className={styles.thumb} />
      </RadixScrollArea.Scrollbar>
    </RadixScrollArea.Root>
  );
}
