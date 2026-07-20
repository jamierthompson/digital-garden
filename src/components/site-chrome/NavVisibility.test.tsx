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

  describe("focus entering the hidden header (browser-QA MEDIUM)", () => {
    // The reveal must happen in JS, synchronously on focusin — the browser computes its
    // focus scroll against the translated box before a CSS reveal can apply, yanking the
    // page. Only the SITE header (a direct <body> child) qualifies; an article's <header>
    // deep in the page must not un-hide the band.
    const mountHeader = (parent: HTMLElement): HTMLButtonElement => {
      const header = document.createElement("header");
      const button = document.createElement("button");
      header.appendChild(button);
      parent.appendChild(header);
      return button;
    };

    afterEach(() => {
      for (const header of document.querySelectorAll("header")) header.remove();
    });

    it("clears data-nav-hidden the moment focus lands inside the site header", () => {
      render(<NavVisibility />);
      const button = mountHeader(document.body);
      scrollTo(600);
      expect(root).toHaveAttribute("data-nav-hidden");

      button.focus();
      expect(root).not.toHaveAttribute("data-nav-hidden");
      // The page is still scrolled — the band is revealed, not "at the top".
      expect(root).toHaveAttribute("data-nav-detached");
    });

    it("ignores focus in a page-content <header> (not a direct body child)", () => {
      render(<NavVisibility />);
      const main = document.createElement("main");
      document.body.appendChild(main);
      const button = mountHeader(main);
      scrollTo(600);

      button.focus();
      expect(root).toHaveAttribute("data-nav-hidden");
      main.remove();
    });

    it("re-hides on the next downward run after a focus reveal", () => {
      render(<NavVisibility />);
      const button = mountHeader(document.body);
      scrollTo(600);
      button.focus();
      expect(root).not.toHaveAttribute("data-nav-hidden");

      scrollTo(700);
      expect(root).toHaveAttribute("data-nav-hidden");
    });

    it("removes the focusin listener on unmount", () => {
      const { unmount } = render(<NavVisibility />);
      const button = mountHeader(document.body);
      scrollTo(600);
      unmount();

      root.dataset.navHidden = ""; // simulate a stale stamp surviving from elsewhere
      button.focus();
      expect(root).toHaveAttribute("data-nav-hidden");
    });
  });
});
