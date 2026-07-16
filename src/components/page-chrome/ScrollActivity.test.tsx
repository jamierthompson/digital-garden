import { fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ScrollActivity from "./ScrollActivity";

const root = document.documentElement;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  root.removeAttribute("data-scrolling");
});

describe("ScrollActivity", () => {
  it("renders nothing", () => {
    const { container } = render(<ScrollActivity />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stamps data-scrolling on the document while scrolling", () => {
    render(<ScrollActivity />);
    expect(root).not.toHaveAttribute("data-scrolling");

    fireEvent.scroll(window);
    expect(root).toHaveAttribute("data-scrolling");
  });

  it("clears data-scrolling once scrolling stops", () => {
    render(<ScrollActivity />);
    fireEvent.scroll(window);

    vi.advanceTimersByTime(1000);
    expect(root).not.toHaveAttribute("data-scrolling");
  });

  it("keeps the thumb visible while scrolling continues (debounced)", () => {
    render(<ScrollActivity />);

    fireEvent.scroll(window);
    vi.advanceTimersByTime(400);
    fireEvent.scroll(window); // resets the idle countdown before it elapses
    vi.advanceTimersByTime(400);
    expect(root).toHaveAttribute("data-scrolling");

    vi.advanceTimersByTime(1000);
    expect(root).not.toHaveAttribute("data-scrolling");
  });

  it("removes its listener on unmount", () => {
    const { unmount } = render(<ScrollActivity />);
    unmount();

    fireEvent.scroll(window);
    expect(root).not.toHaveAttribute("data-scrolling");
  });

  describe("QA — adversarial", () => {
    it("renders to static markup without touching window/document (SSR-safe)", () => {
      // The component mounts in the App Router root layout and renders on the server first.
      // `document` is read inside useEffect, which never runs during SSR — so a server render
      // must neither throw nor emit markup. Proven here rather than asserted from memory.
      let html = "sentinel";
      expect(() => {
        html = renderToStaticMarkup(<ScrollActivity />);
      }).not.toThrow();
      expect(html).toBe("");
    });

    it("stamps the attribute as an empty string (a bare `data-scrolling`)", () => {
      render(<ScrollActivity />);
      fireEvent.scroll(window);
      // The CSS selector is `html[data-scrolling]` (presence), so the value must be empty —
      // not "true"/"1" — to read as a bare boolean attribute in the serialized DOM.
      expect(root.getAttribute("data-scrolling")).toBe("");
    });

    it("holds the thumb up to the idle boundary and clears exactly at it", () => {
      render(<ScrollActivity />);
      fireEvent.scroll(window);

      vi.advanceTimersByTime(699); // one tick shy of the 700ms idle delay
      expect(root).toHaveAttribute("data-scrolling");

      vi.advanceTimersByTime(1); // now exactly at 700ms — the timeout fires
      expect(root).not.toHaveAttribute("data-scrolling");
    });

    it("re-arms after clearing: a fresh scroll re-stamps the attribute", () => {
      render(<ScrollActivity />);

      fireEvent.scroll(window);
      vi.advanceTimersByTime(1000);
      expect(root).not.toHaveAttribute("data-scrolling");

      fireEvent.scroll(window);
      expect(root).toHaveAttribute("data-scrolling");
    });

    it("clearing an already-absent attribute is a harmless no-op (does not throw)", () => {
      render(<ScrollActivity />);
      // Two scrolls whose idle timers both eventually run: the second `delete` executes while
      // the attribute is already gone. `delete root.dataset.scrolling` on an absent attribute
      // must be a silent no-op, not an error.
      fireEvent.scroll(window);
      vi.advanceTimersByTime(1000);
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
      expect(root).not.toHaveAttribute("data-scrolling");
    });

    it("survives unmount → remount with a single working listener (StrictMode-style)", () => {
      const first = render(<ScrollActivity />);
      first.unmount();

      render(<ScrollActivity />);
      fireEvent.scroll(window);
      expect(root).toHaveAttribute("data-scrolling");

      // Exactly one active listener → exactly one idle timer → clears once, cleanly.
      vi.advanceTimersByTime(1000);
      expect(root).not.toHaveAttribute("data-scrolling");
    });

    it("the pending idle timeout does not fire after unmount", () => {
      const { unmount } = render(<ScrollActivity />);
      fireEvent.scroll(window);
      unmount();
      // Cleanup clears the timer, so advancing past the delay must not run its callback (no
      // post-unmount DOM mutation, no error against a torn-down tree).
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    });

    // DEFECT (minor) — cleanup clears the timer and the listener but NOT the `data-scrolling`
    // attribute. Unmounting mid-scroll (attribute still stamped, idle timer pending) leaves the
    // thumb permanently revealed, because the pending `delete` is cancelled and nothing else
    // resets it. This assertion pins the correct behavior and FAILS today. Practical impact is
    // low (the root-layout mount effectively never unmounts), but the cleanup should also
    // `delete root.dataset.scrolling`. Verified: `+ true` (attribute persists after unmount).
    it("clears data-scrolling on unmount even when scrolling was in progress", () => {
      const { unmount } = render(<ScrollActivity />);
      fireEvent.scroll(window);
      expect(root).toHaveAttribute("data-scrolling"); // stamped by the scroll

      unmount();
      vi.advanceTimersByTime(1000);
      expect(root).not.toHaveAttribute("data-scrolling");
    });
  });
});
