import { render } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import NavVisibility from "./NavVisibility";

const root = document.documentElement;

/** jsdom performs no scrolling — set the position, then fire the event the browser would. */
function scrollTo(y: number): void {
  Object.defineProperty(window, "scrollY", {
    value: y,
    writable: true,
    configurable: true,
  });
  fireEvent.scroll(window);
}

afterEach(() => {
  root.removeAttribute("data-nav-hidden");
  root.removeAttribute("data-nav-detached");
  Object.defineProperty(window, "scrollY", {
    value: 0,
    writable: true,
    configurable: true,
  });
});

/**
 * QA — the boundary arithmetic. `HIDE_MIN_Y_PX` (96) and `DIRECTION_MIN_DELTA_PX` (4) INTERACT:
 * the author's suite tests each in isolation (50px "inside the threshold", ±2px jitter at 600px)
 * and never the seam where one hands off to the other.
 */
describe("NavVisibility — threshold ↔ jitter-filter seam", () => {
  it("never hides at EXACTLY the threshold, arriving from a deep scroll", () => {
    render(<NavVisibility />);
    scrollTo(600);
    expect(root).toHaveAttribute("data-nav-hidden");

    scrollTo(96); // the boundary itself is inclusive-safe (`y <= HIDE_MIN_Y_PX`)
    expect(root).not.toHaveAttribute("data-nav-hidden");
    expect(root).toHaveAttribute("data-nav-detached");
  });

  it("one pixel over the threshold is not enough travel to hide", () => {
    // Crossing the line re-anchors `lastY` AT the line, so the first hide needs a further
    // DIRECTION_MIN_DELTA_PX of travel: the real first-hide point is ~100px, not 96px.
    render(<NavVisibility />);
    scrollTo(96);
    scrollTo(97);
    expect(root).not.toHaveAttribute("data-nav-hidden");

    scrollTo(101);
    expect(root).toHaveAttribute("data-nav-hidden");
  });

  it("re-hides after a threshold-crossing reveal (lastY re-anchors at the boundary)", () => {
    render(<NavVisibility />);
    scrollTo(600);
    scrollTo(40); // back inside the threshold — revealed and re-anchored
    expect(root).not.toHaveAttribute("data-nav-hidden");

    scrollTo(400); // a fresh downward run
    expect(root).toHaveAttribute("data-nav-hidden");
  });

  it("survives rapid direction reversals straddling the threshold", () => {
    render(<NavVisibility />);
    for (const y of [300, 20, 300, 20, 300]) scrollTo(y);
    expect(root).toHaveAttribute("data-nav-hidden");
    scrollTo(20);
    expect(root).not.toHaveAttribute("data-nav-hidden");
    expect(root).toHaveAttribute("data-nav-detached");
  });

  it("does not flash hidden when a mid-page load is followed by an immediate upward scroll", () => {
    Object.defineProperty(window, "scrollY", {
      value: 800,
      writable: true,
      configurable: true,
    });
    render(<NavVisibility />);
    expect(root).not.toHaveAttribute("data-nav-hidden");

    scrollTo(700);
    expect(root).not.toHaveAttribute("data-nav-hidden");
  });

  it("degrades safely if scrollY is NaN (revealed, not stuck hidden)", () => {
    render(<NavVisibility />);
    scrollTo(600);
    expect(root).toHaveAttribute("data-nav-hidden");

    scrollTo(Number.NaN);
    expect(root).not.toHaveAttribute("data-nav-hidden");
    expect(root).not.toHaveAttribute("data-nav-detached");
  });
});

/**
 * QA — DEFECT: the handler writes both dataset properties on EVERY scroll event, with no
 * state-change guard and no rAF coalescing. `setAttribute` to an unchanged value still
 * invalidates style on `<html>`, so a continuous scroll dirties the root element's style
 * once per event and the NEXT event's `window.scrollY` read forces the recalc — the classic
 * read-after-write thrash, on the hottest path the page has (an INP/CWV risk).
 *
 * This test is expected to FAIL against the slice as delivered. It pins the fix: only touch
 * the DOM when the computed state actually changes.
 */
describe("NavVisibility — DOM write churn on the scroll hot path", () => {
  it("writes to <html> only when the computed state changes", () => {
    render(<NavVisibility />);
    scrollTo(200); // settle into hidden + detached
    expect(root).toHaveAttribute("data-nav-hidden");

    const observer = new MutationObserver(() => {});
    observer.observe(root, { attributes: true });

    // A continuous downward flick: 12 more events, zero state changes.
    for (let y = 300; y <= 1400; y += 100) scrollTo(y);

    const records = observer.takeRecords();
    observer.disconnect();
    expect(records.map((r) => r.attributeName)).toEqual([]);
  });
});

/**
 * QA — concurrency. React 19 StrictMode double-invokes effects, and a stray second mount is a
 * live possibility in a layout this component sits in. Teardown is unconditional, so ONE
 * instance unmounting wipes the state a still-listening instance owns.
 */
describe("NavVisibility — concurrent instances", () => {
  it("does not let one instance's teardown wipe a still-mounted instance's state", () => {
    const first = render(<NavVisibility />);
    render(<NavVisibility />);
    scrollTo(600);
    expect(root).toHaveAttribute("data-nav-hidden");

    first.unmount();
    // The second instance is still listening and the page is still scrolled past the
    // threshold, so the header must still be hidden.
    expect(root).toHaveAttribute("data-nav-hidden");
    expect(root).toHaveAttribute("data-nav-detached");
  });
});
