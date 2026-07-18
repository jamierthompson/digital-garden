"use client";

import { useEffect } from "react";

/** How long after the last scroll the thumb hides again. */
const IDLE_DELAY_MS = 700;

/**
 * Reveals the native scrollbar thumb only while the document is scrolling. Native scrollbars
 * expose no "is-scrolling" CSS state, so this stamps `data-scrolling` on the document element
 * during a scroll and clears it once scrolling stops. Renders nothing.
 */
export default function ScrollActivity(): null {
  useEffect(() => {
    const root = document.documentElement;
    let timer: number | undefined;

    const onScroll = (): void => {
      root.dataset.scrolling = "";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        delete root.dataset.scrolling;
      }, IDLE_DELAY_MS);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      // Reset the flag on teardown too: unmounting mid-scroll cancels the pending clear, so
      // without this the thumb would stay revealed.
      delete root.dataset.scrolling;
    };
  }, []);

  return null;
}
