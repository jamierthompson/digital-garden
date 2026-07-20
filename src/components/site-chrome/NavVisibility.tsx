"use client";

import { useEffect } from "react";

/* Hide only once the band's own tallest fluid height (~92px) has scrolled past, so the header
   never vanishes while it is still meaningfully "at the top". */
const HIDE_MIN_Y_PX = 96;

/* A direction flip needs this much travel before it counts — trackpad and momentum scrolling
   jitter by a pixel or two around a settle point, which must not flap the header. */
const DIRECTION_MIN_DELTA_PX = 4;

/* Live-instance count: teardown may only wipe the document attributes when the LAST instance
   leaves — an earlier unmount must not erase state a still-listening instance owns. */
let instances = 0;

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
    instances += 1;
    const root = document.documentElement;
    let lastY = window.scrollY;
    // Mirror the stamped state locally so the scroll handler touches the DOM only on a real
    // transition: an unconditional set dirties <html> style once per event, and the next
    // event's scrollY read forces the recalc — write-then-read thrash on the hottest path
    // the page has (QA finding D1). Seed the mirrors from the DOCUMENT, not empty: a second
    // instance mounting mid-page would otherwise read its own blank mirror as a transition
    // and delete the attribute a live instance owns (QA re-check finding).
    let hidden = "navHidden" in root.dataset;
    let detached = "navDetached" in root.dataset;

    const onScroll = (): void => {
      // iOS rubber-banding reports negative positions at the top, which would read as an upward
      // flick followed by a phantom downward one — clamp so overscroll is "at the top".
      const y = Math.max(0, window.scrollY);

      const nextDetached = y > 0;
      let nextHidden: boolean;
      if (y <= HIDE_MIN_Y_PX) {
        nextHidden = false;
        lastY = y;
      } else {
        const delta = y - lastY;
        if (Math.abs(delta) < DIRECTION_MIN_DELTA_PX) {
          nextHidden = hidden;
        } else {
          nextHidden = delta > 0;
          lastY = y;
        }
      }

      if (nextDetached !== detached) {
        detached = nextDetached;
        if (nextDetached) root.dataset.navDetached = "";
        else delete root.dataset.navDetached;
      }
      if (nextHidden !== hidden) {
        hidden = nextHidden;
        if (nextHidden) root.dataset.navHidden = "";
        else delete root.dataset.navHidden;
      }
    };

    // Focus entering the hidden header must reveal it BEFORE the browser scrolls the focused
    // element into view: the scroll is computed against the translated (off-viewport) box, and
    // a CSS-only reveal lands after that math — a single Shift+Tab into the band yanked the
    // page hundreds of pixels (browser-QA MEDIUM). Only keyboard/programmatic focus can reach
    // an off-screen control, so no pointer-focus scoping is needed here; the CSS side
    // (`:has(:focus-visible)`) owns KEEPING the band open under keyboard focus.
    const onFocusIn = (event: FocusEvent): void => {
      if (!hidden) return;
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest("body > header")) return;
      hidden = false;
      delete root.dataset.navHidden;
    };

    // A reload can land mid-page: stamp the detached state before the first scroll event.
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      instances -= 1;
      // Teardown mid-scroll must not strand the header hidden or bordered — but only the last
      // instance out may wipe the document (QA finding D2).
      if (instances === 0) {
        delete root.dataset.navHidden;
        delete root.dataset.navDetached;
      }
    };
  }, []);

  return null;
}
