import { fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
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

describe("NavVisibility", () => {
  it("renders nothing", () => {
    const { container } = render(<NavVisibility />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stamps neither attribute at the top of the page", () => {
    render(<NavVisibility />);
    expect(root).not.toHaveAttribute("data-nav-hidden");
    expect(root).not.toHaveAttribute("data-nav-detached");
  });

  it("hides on a downward scroll past the header's own height", () => {
    render(<NavVisibility />);
    scrollTo(300);
    expect(root).toHaveAttribute("data-nav-hidden");
  });

  it("reveals on any upward scroll, however deep in the page", () => {
    render(<NavVisibility />);
    scrollTo(600);
    expect(root).toHaveAttribute("data-nav-hidden");

    scrollTo(560);
    expect(root).not.toHaveAttribute("data-nav-hidden");
  });

  it("never hides within the header's own height of the top", () => {
    // Inside the threshold the band still reads as "at the top" — a small downward drift
    // there must not vanish it.
    render(<NavVisibility />);
    scrollTo(50);
    expect(root).toHaveAttribute("data-nav-detached");
    expect(root).not.toHaveAttribute("data-nav-hidden");
  });

  it("always reveals on return to the top, whatever the direction history", () => {
    render(<NavVisibility />);
    scrollTo(600);
    expect(root).toHaveAttribute("data-nav-hidden");

    scrollTo(0);
    expect(root).not.toHaveAttribute("data-nav-hidden");
    expect(root).not.toHaveAttribute("data-nav-detached");
  });

  it("stamps detached whenever the page is scrolled at all", () => {
    render(<NavVisibility />);
    scrollTo(1);
    expect(root).toHaveAttribute("data-nav-detached");
    scrollTo(0);
    expect(root).not.toHaveAttribute("data-nav-detached");
  });

  it("removes its listener and both attributes on unmount", () => {
    const { unmount } = render(<NavVisibility />);
    scrollTo(600);
    expect(root).toHaveAttribute("data-nav-hidden");

    unmount();
    expect(root).not.toHaveAttribute("data-nav-hidden");
    expect(root).not.toHaveAttribute("data-nav-detached");

    scrollTo(900);
    expect(root).not.toHaveAttribute("data-nav-hidden");
  });

  describe("QA — adversarial", () => {
    it("renders to static markup without touching window/document (SSR-safe)", () => {
      // Mounted in the root layout, so it server-renders first: must neither throw nor emit
      // markup.
      let html = "sentinel";
      expect(() => {
        html = renderToStaticMarkup(<NavVisibility />);
      }).not.toThrow();
      expect(html).toBe("");
    });

    it("stamps both attributes as bare booleans (empty string values)", () => {
      // The CSS selectors are presence checks (`html[data-nav-hidden]`), so the values must
      // serialize as bare attributes.
      render(<NavVisibility />);
      scrollTo(600);
      expect(root.getAttribute("data-nav-hidden")).toBe("");
      expect(root.getAttribute("data-nav-detached")).toBe("");
    });

    it("stamps detached on mount when the page loads already scrolled (mid-page reload)", () => {
      Object.defineProperty(window, "scrollY", {
        value: 400,
        writable: true,
        configurable: true,
      });
      render(<NavVisibility />);
      expect(root).toHaveAttribute("data-nav-detached");
      // No direction has been expressed yet, so the header stays visible.
      expect(root).not.toHaveAttribute("data-nav-hidden");
    });

    it("ignores sub-threshold jitter around a settle point (no flapping)", () => {
      render(<NavVisibility />);
      scrollTo(600);
      expect(root).toHaveAttribute("data-nav-hidden");

      // Momentum settle: ±2px wiggles must not read as an upward flick.
      scrollTo(598);
      expect(root).toHaveAttribute("data-nav-hidden");
      scrollTo(600);
      expect(root).toHaveAttribute("data-nav-hidden");
    });

    it("treats rubber-band overscroll (negative scrollY) as the top", () => {
      render(<NavVisibility />);
      scrollTo(200);
      scrollTo(-30); // iOS bounce above the top
      expect(root).not.toHaveAttribute("data-nav-hidden");
      expect(root).not.toHaveAttribute("data-nav-detached");
    });

    it("hides again on the next downward run after a reveal", () => {
      render(<NavVisibility />);
      scrollTo(600);
      scrollTo(500); // reveal
      expect(root).not.toHaveAttribute("data-nav-hidden");

      scrollTo(700);
      expect(root).toHaveAttribute("data-nav-hidden");
    });

    it("survives unmount → remount with a single working listener (StrictMode-style)", () => {
      const first = render(<NavVisibility />);
      first.unmount();

      render(<NavVisibility />);
      scrollTo(600);
      expect(root).toHaveAttribute("data-nav-hidden");
    });
  });
});

/**
 * The boundary arithmetic. `HIDE_MIN_Y_PX` (96) and `DIRECTION_MIN_DELTA_PX` (4) INTERACT:
 * crossing the threshold re-anchors `lastY`, so the seam where one hands off to the other has
 * behavior neither constant describes alone.
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
 * The scroll handler must touch the DOM only when the computed state changes. `setAttribute`
 * to an unchanged value still invalidates style on `<html>`, and the next event's
 * `window.scrollY` read forces the recalc — read-after-write thrash on the hottest path the
 * page has (an INP/CWV risk).
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
 * Concurrent instances (React 19 StrictMode double-invokes effects, and a stray second mount
 * is a live possibility in a layout this component sits in): neither an instance's teardown
 * nor its mount may clobber the state a still-listening instance owns.
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

  it("a newly-mounted instance adopts the live state instead of stomping it", () => {
    // The state mirrors seed from the document: a joining instance whose mount-time scroll
    // lands in the jitter branch must read the LIVE stamped state, not assert its own empty
    // mirror as a transition.
    render(<NavVisibility />);
    scrollTo(600);
    expect(root).toHaveAttribute("data-nav-hidden");

    render(<NavVisibility />); // a second instance joins mid-page

    expect(root).toHaveAttribute("data-nav-hidden");
    expect(root).toHaveAttribute("data-nav-detached");
  });
});
