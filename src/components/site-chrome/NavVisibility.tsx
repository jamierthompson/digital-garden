"use client";

import { useEffect } from "react";

/* Hide only once the band's own tallest fluid height (~92px) has scrolled past, so the header
   never vanishes while it is still meaningfully "at the top". */
const HIDE_MIN_Y_PX = 96;

/* A direction flip needs this much travel before it counts — trackpad and momentum scrolling
   jitter by a pixel or two around a settle point, which must not flap the header. */
const DIRECTION_MIN_DELTA_PX = 4;

/**
 * Drives the auto-hiding sticky header. Scroll direction is the visitor's intent signal — down
 * means "reading, get out of the way", up means "reorienting, bring the nav" — but native scroll
 * exposes no direction in CSS, so this stamps two attributes on the document element and the
 * header's module does the visuals: `data-nav-hidden` while scrolling down past the band's own
 * height (cleared on any upward travel and always near the top), and `data-nav-detached` whenever
 * the page is scrolled at all (the header's floating-over-content border). Renders nothing.
 */
export default function NavVisibility(): null {
  useEffect(() => {
    const root = document.documentElement;
    let lastY = window.scrollY;

    const onScroll = (): void => {
      // iOS rubber-banding reports negative positions at the top, which would read as an upward
      // flick followed by a phantom downward one — clamp so overscroll is "at the top".
      const y = Math.max(0, window.scrollY);

      if (y > 0) root.dataset.navDetached = "";
      else delete root.dataset.navDetached;

      if (y <= HIDE_MIN_Y_PX) {
        delete root.dataset.navHidden;
        lastY = y;
        return;
      }

      const delta = y - lastY;
      if (Math.abs(delta) < DIRECTION_MIN_DELTA_PX) return;
      if (delta > 0) root.dataset.navHidden = "";
      else delete root.dataset.navHidden;
      lastY = y;
    };

    // A reload can land mid-page: stamp the detached state before the first scroll event.
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      // Teardown mid-scroll must not strand the header hidden or bordered.
      delete root.dataset.navHidden;
      delete root.dataset.navDetached;
    };
  }, []);

  return null;
}
