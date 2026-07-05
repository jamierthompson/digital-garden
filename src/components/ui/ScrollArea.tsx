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
      {/* VERTICAL ONLY — no horizontal Scrollbar + no Corner (owner: the vertical track must run
          flush to the footer). Radix insets the vertical scrollbar by `bottom:
          var(--radix-scroll-area-corner-height)` — the horizontal scrollbar's reserved corner —
          so an always-mounted (`type="always"`) horizontal bar stopped the vertical thumb ~10px
          short of the footer even though the canvas never scrolls sideways. It doesn't need to:
          the canvas is a single full-width column, and the only wide elements (the palette table,
          the mini-ramp strips) scroll INTERNALLY (`overflow-x: auto`). Dropping the horizontal
          bar removes the corner reservation, so the vertical track spans the full viewport. */}
      <RadixScrollArea.Scrollbar
        orientation="vertical"
        className={styles.scrollbar}
      >
        <RadixScrollArea.Thumb className={styles.thumb} />
      </RadixScrollArea.Scrollbar>
    </RadixScrollArea.Root>
  );
}
