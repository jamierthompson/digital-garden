import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import postcss from "postcss";

import { readModuleCss, ruleDeclarations } from "../../../tests/cssModule";

import styles from "./MobileNav.module.css";
import MobileNav from "./MobileNav";
import SiteNav from "./SiteNav";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

beforeEach(() => {
  pathname = "/";
});

afterEach(() => {
  // The scroll lock writes to body; leaking it across tests hides a failure to release.
  document.body.removeAttribute("style");
});

/** Opens the panel in an ALREADY-rendered tree (the harvested cases render SiteNav themselves). */
const openPanelHere = (): HTMLElement => {
  fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
  return screen.getByRole("dialog");
};

const openPanel = (): HTMLElement => {
  render(<MobileNav />);
  fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
  return screen.getByRole("dialog");
};

describe("MobileNav", () => {
  it("is a labelled trigger that opens a named dialog", () => {
    const panel = openPanel();
    // Radix warns (and AT announces nothing useful) without a Title; it is visually hidden, so
    // only the accessible name proves it is wired.
    expect(panel).toHaveAccessibleName("Site navigation");
  });

  it("exposes the destinations as LINKS, never as menu items", () => {
    // The reason this is a Dialog and not a DropdownMenu: a dropdown would announce these as
    // `menuitem`s — a menu of commands — when they are navigation links.
    const panel = openPanel();
    expect(within(panel).queryByRole("menu")).toBeNull();
    expect(within(panel).queryAllByRole("menuitem")).toHaveLength(0);
    const hrefs = within(panel)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/", "/browse", "/system", "/about", "/now"]),
    );
  });

  it("keeps the scheme toggle reachable INSIDE the panel", () => {
    // The owner's requirement: the toggle stays available while the menu is open. Under a modal
    // dialog everything outside the panel is inert, so a toggle left in the header would be
    // visible-but-dead. It has to be inside the panel to be real.
    const panel = openPanel();
    expect(
      within(panel).getByRole("button", { name: /switch to .* mode/i }),
    ).toBeInTheDocument();
  });

  it("closes on the close control", () => {
    const panel = openPanel();
    fireEvent.click(within(panel).getByRole("button", { name: /close menu/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when a destination is activated", () => {
    // The panel lives in the persistent layout, so a client-side navigation does NOT unmount
    // it. Without the onNavigate wiring the panel would still be covering the page the user
    // just navigated to — invisible in a route-less unit test, hence this pin.
    const panel = openPanel();
    fireEvent.click(within(panel).getByRole("link", { name: "about" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns focus to the trigger on close, without scrolling to it", async () => {
    // Radix's default focus restore scrolls an off-screen trigger into view, which throws a
    // scrolled reader back to the top on dismissal. Focus must still come BACK — just without
    // the scroll — so both halves are asserted. Radix runs the restore asynchronously.
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /open menu/i });
    const focus = vi.spyOn(trigger, "focus");
    fireEvent.click(trigger);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /close menu/i,
      }),
    );
    await waitFor(() =>
      expect(focus).toHaveBeenCalledWith({ preventScroll: true }),
    );
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape", () => {
    const panel = openPanel();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders nothing but the trigger while closed", () => {
    render(<MobileNav />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByRole("button", { name: /open menu/i }),
    ).toBeInTheDocument();
  });
});

/**
 * jsdom lays nothing out, so the panel's geometry and — critically — its agreement with the
 * header's bar can only be pinned at the source.
 */
describe("MobileNav source-pinned geometry", () => {
  const css = readModuleCss("src/components/site-chrome/MobileNav.module.css");
  const siteNavCss = readModuleCss(
    "src/components/site-chrome/SiteNav.module.css",
  );

  it("the panel's bar padding is IDENTICAL to the header row's", () => {
    // The panel draws its own bar so the toggle stays operable while open. That only reads as
    // "nothing moved" if both bars use the same fluid padding — any divergence makes the mark
    // and the icons jump at the moment of opening, at some viewport widths and not others.
    const bar = ruleDeclarations(css, ".barRow");
    const row = ruleDeclarations(siteNavCss, ".row");
    const normalize = (v: string | undefined): string =>
      (v ?? "").replace(/\s+/g, " ").trim();

    const barStart = normalize(
      ruleDeclarations(css, ".barRow").get("--mobile-nav-pad-block-start"),
    );
    const rowStart = normalize(
      ruleDeclarations(siteNavCss, ".header").get("--site-nav-pad-block-start"),
    );
    expect(barStart).not.toBe("");
    expect(barStart).toBe(rowStart);

    expect(normalize(bar.get("padding-block-start"))).toBe(
      "var(--mobile-nav-pad-block-start)",
    );
    expect(normalize(row.get("padding-block-start"))).toBe(
      "var(--site-nav-pad-block-start)",
    );
  });

  it("spaces the controls exactly as the header does", () => {
    // The close glyph replaces the menu glyph in place, so the gap to the toggle beside it has
    // to match or the toggle jumps sideways on open. Cluster's own default is narrower than the
    // band's gap, so falling through to it is the failure mode — and jsdom can't see it.
    const panelGap = ruleDeclarations(css, ".controls").get(
      "--mobile-nav-controls-gap",
    );
    const headerGap = ruleDeclarations(siteNavCss, ".header").get(
      "--site-nav-gap",
    );
    expect(panelGap).toBeDefined();
    expect(panelGap).toBe(headerGap);
    expect(ruleDeclarations(css, ".controls").get("--cluster-gap")).toBe(
      "var(--mobile-nav-controls-gap)",
    );
  });

  it("insets by the gutter, where the header's contents begin", () => {
    // Below the band's 28rem threshold the header's `wide` lane starts exactly one gutter from
    // the edge, so this is what keeps the bar from moving sideways as the panel opens.
    expect(ruleDeclarations(css, ".panel").get("--mobile-nav-inset")).toBe(
      "var(--space-gutter)",
    );
    expect(ruleDeclarations(css, ".panel").get("padding-inline")).toBe(
      "var(--mobile-nav-inset)",
    );
    expect(ruleDeclarations(siteNavCss, ".row").get("grid-column")).toBe(
      "wide",
    );
  });

  it("does NOT compensate for the scrollbar the scroll lock removes", () => {
    // Measured: with the compensation applied, the bar's right-hand controls jumped 11px inward
    // on open — nine times the defect it was meant to prevent. The panel's fixed containing
    // block is already the narrower width because the gutter is permanently reserved, so
    // offsetting again double-corrects. Symmetric padding is the correct answer HERE, which is
    // why this is pinned rather than left to look like an oversight.
    const panel = ruleDeclarations(css, ".panel");
    expect(panel.get("padding-inline")).toBe("var(--mobile-nav-inset)");
    // Comments stripped: the rule above is explained in prose that names the variable.
    expect(css.replace(/\/\*[\s\S]*?\*\//g, " ")).not.toContain(
      "--removed-body-scroll-bar-size",
    );
  });

  it("depends on the reserved scrollbar gutter, so pin that it still exists", () => {
    // The rule above is only correct while `reset.css` reserves the gutter on every route.
    // Dropping `scrollbar-gutter: stable` would silently reintroduce the horizontal jump here,
    // in a file that has nothing to do with this component.
    const reset = readModuleCss("src/styles/reset.css");
    expect(ruleDeclarations(reset, "html").get("scrollbar-gutter")).toBe(
      "stable",
    );
  });

  it("leaves trailing room so the last link's ring isn't clipped", () => {
    // In a short viewport the panel scrolls; with no end padding the final link's focus ring is
    // cut by the scroll box's clip edge.
    expect(ruleDeclarations(css, ".panel").get("padding-block-end")).toBe(
      "var(--mobile-nav-foot)",
    );
  });

  it("the trigger's wrapper is flex, so the glyph centres on the row", () => {
    // A block wrapper around an inline-level button adds inline half-leading and lifts the glyph
    // ~1px off the centre line shared with the toggle beside it. Too small for CLS to record —
    // and the two glyphs are different elements, so no layout-shift entry is generated at all.
    expect(ruleDeclarations(siteNavCss, ".mobileNav").get("display")).toBe(
      "flex",
    );
  });

  it("the panel is full-height in DYNAMIC viewport units", () => {
    // `100vh` is the LARGE viewport on mobile — with the URL bar shown, a 100vh panel is taller
    // than the visible area and its foot is unreachable. `dvh` tracks the visible height.
    const panel = ruleDeclarations(css, ".panel");
    expect(panel.get("block-size")).toBe("100dvh");
    expect(panel.get("position")).toBe("fixed");
    expect(panel.get("overflow-y")).toBe("auto");
  });

  it("animates open AND closed with keyframes, never a transition", () => {
    // Radix defers unmount on `animationend` + a computed `animationName` read
    // (@radix-ui/react-presence) — it never listens for `transitionend`. A transitioned panel is
    // unmounted the instant it closes, so the exit is never seen.
    expect(css).toMatch(/@keyframes\s+panel-in/);
    expect(css).toMatch(/@keyframes\s+panel-out/);
    expect(
      ruleDeclarations(css, '.panel[data-state="open"]').get("animation"),
    ).toContain("panel-in");
    expect(
      ruleDeclarations(css, '.panel[data-state="closed"]').get("animation"),
    ).toContain("panel-out");
    expect(ruleDeclarations(css, ".panel").has("transition")).toBe(false);
  });

  it("the panel is opaque and sits on the modal layer", () => {
    // A transparent panel would show the page through a full-screen nav; the z-index comes from
    // the token scale, not a hand-picked number.
    const panel = ruleDeclarations(css, ".panel");
    expect(panel.get("background")).toBe("var(--background)");
    expect(panel.get("z-index")).toBe("var(--z-modal)");
  });

  it("floors the trigger/close target at 24×24 on BOTH axes", () => {
    // WCAG 2.2 SC 2.5.8: https://www.w3.org/TR/WCAG22/#target-size-minimum
    // `--size-icon` is smaller than the floor, so the control supplies the target.
    const trigger = ruleDeclarations(css, ".trigger");
    expect(trigger.get("min-inline-size")).toBe("var(--size-control)");
    expect(trigger.get("min-block-size")).toBe("var(--size-control)");
  });

  it("styles focus-visible with the ring tokens — never bare :focus", () => {
    const focusVisible = ruleDeclarations(css, ".trigger:focus-visible");
    expect(focusVisible.get("outline")).toBe(
      "var(--ring-width) var(--ring-style) var(--ring)",
    );
    expect(ruleDeclarations(css, ".trigger:focus").size).toBe(0);
  });

  it("draws the stacked current-page indicator on the WORD, not the full-width box", () => {
    // The stacked link fills its row for the tap target, so the row's `border-bottom` indicator
    // would stretch the whole panel width. Target and indicator are deliberately separated: the
    // box stays full width, the underline sits on the label.
    const navLinks = readModuleCss(
      "src/components/site-chrome/NavLinks.module.css",
    );
    expect(
      ruleDeclarations(navLinks, ".stack .link").get("border-bottom-color"),
    ).toBe("transparent");
    expect(
      ruleDeclarations(navLinks, ".stack .active .label").get(
        "border-bottom-color",
      ),
    ).toBe("var(--foreground)");
    // Reserved on every item so activating one shifts nothing — the same no-shift contract the
    // row keeps, moved to the element that now carries the ink.
    expect(
      ruleDeclarations(navLinks, ".stack .label").get("border-bottom"),
    ).toBe("var(--border-width-thick) solid transparent");
  });

  it("stacked links fill their row, so the tap target is the row not the word", () => {
    // The row presentation is `inline-flex` (content-sized). Left as-is in the column, each
    // link's target would be the width of its label — ~40px on a 390px panel. jsdom lays
    // nothing out, so only the source shows it.
    const navLinks = readModuleCss(
      "src/components/site-chrome/NavLinks.module.css",
    );
    expect(ruleDeclarations(navLinks, ".stack .link").get("display")).toBe(
      "flex",
    );
  });

  it("paints the glyphs from the graphic ink, not a text role", () => {
    // Also enforced repo-wide by `pnpm lint:icon`; pinned here as this component's contract.
    const trigger = ruleDeclarations(css, ".trigger");
    expect(trigger.get("--mobile-nav-ink")).toBe("var(--icon)");
    expect(trigger.get("--mobile-nav-ink-hover")).toBe("var(--foreground)");
  });
});

/**
 * The swap between the two presentations is pure CSS, so it is invisible to every render test
 * above — and getting it wrong ships BOTH navs, or neither, at some widths.
 */
describe("SiteNav presentation swap", () => {
  const siteNavCss = readModuleCss(
    "src/components/site-chrome/SiteNav.module.css",
  );
  const source = siteNavCss;

  it("queries the BAND, not the viewport", () => {
    // The constraint is whether the row has room, which a viewport breakpoint does not measure.
    expect(source).toMatch(/@container\s+site-nav\s*\(min-width/);
    expect(ruleDeclarations(siteNavCss, ".row").get("container")).toBe(
      "site-nav / inline-size",
    );
  });

  it("names the container it queries", () => {
    // An `@container` naming a container that does not exist never matches, and the inline nav
    // would simply never appear — at any width.
    const declared = /container:\s*([\w-]+)\s*\//.exec(source)?.[1];
    const queried = /@container\s+([\w-]+)\s*\(/.exec(source)?.[1];
    expect(declared).toBeDefined();
    expect(queried).toBe(declared);
  });

  it("hides the inline nav by default and reveals it in the query", () => {
    // Mobile-first: the trigger is the default presentation. If the default were reversed, a
    // browser that failed the query would show the desktop row on a phone.
    expect(ruleDeclarations(source, ".inlineNav").get("display")).toBe("none");
    expect(source).toMatch(
      /@container[^{]*\{[\s\S]*\.inlineNav\s*\{\s*display:\s*block/,
    );
    expect(source).toMatch(
      /@container[^{]*\{[\s\S]*\.mobileNav\s*\{\s*display:\s*none/,
    );
  });
});

describe("MobileNav — duplicate chrome while the panel is open (claim: outside is hidden)", () => {
  // A non-home path, so the panel's Logo is a real destination and a stacked item is current.
  beforeEach(() => {
    pathname = "/about";
  });

  it("exposes exactly ONE Primary navigation landmark to AT while open", () => {
    // The slice deliberately ships two <nav aria-label="Primary"> in the DOM while open.
    // That is only acceptable if the header's copy is aria-hidden by the modal — otherwise a
    // screen-reader's landmark rotor lists "Primary navigation" twice with different behavior.
    render(<SiteNav />);
    openPanelHere();
    expect(document.querySelectorAll("nav").length).toBe(2);
    expect(
      screen.getAllByRole("navigation", { name: /primary/i }),
    ).toHaveLength(1);
  });

  it("exposes exactly ONE scheme toggle and ONE home logo link to AT while open", () => {
    render(<SiteNav />);
    const panel = openPanelHere();
    const toggles = screen.getAllByRole("button", {
      name: /switch to .* mode/i,
    });
    expect(toggles).toHaveLength(1);
    expect(panel.contains(toggles[0])).toBe(true);
    const logos = screen.getAllByRole("link", { name: "jamie thompson" });
    expect(logos).toHaveLength(1);
    expect(panel.contains(logos[0])).toBe(true);
  });

  it("hides the header's own trigger from AT while open (a visible-but-inert control must not be announced)", () => {
    render(<SiteNav />);
    openPanelHere();
    // The only accessible menu-ish button left should be the panel's close control.
    expect(
      screen.queryByRole("button", { name: /open menu/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /close menu/i }),
    ).toBeInTheDocument();
  });

  it("restores the header's landmarks to AT after close", () => {
    render(<SiteNav />);
    const panel = openPanelHere();
    fireEvent.click(within(panel).getByRole("button", { name: /close menu/i }));
    expect(
      screen.getAllByRole("navigation", { name: /primary/i }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /open menu/i }),
    ).toBeInTheDocument();
  });

  it("keeps the panel's current-page indicator in the stacked list (aria-current survives the wrap)", () => {
    render(<SiteNav />);
    const panel = openPanelHere();
    const current = within(panel).getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("about");
  });
});

describe("MobileNav — every activation path out of the panel", () => {
  it("closes when the panel's LOGO home link is activated, like any other destination", () => {
    // The slice's own contract (NavLinks.onNavigate): the panel lives in the persistent
    // layout, so a client-side navigation does NOT unmount it. The panel's Logo is a home
    // link — activating it navigates exactly like the "featured" item, but it is wired to
    // no onNavigate, so the panel stays up, covering the page the user just navigated to.
    render(<MobileNav />);
    const panel = openPanelHere();
    fireEvent.click(
      within(panel).getByRole("link", { name: "jamie thompson" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open on a modified click (cmd/ctrl+click opens a NEW tab — this page did not navigate)", () => {
    // next/link only client-navigates an unmodified main-button click; with a modifier the
    // browser opens a new tab and THIS page stays where it is. Closing the panel here means
    // the current page's nav vanishes even though no navigation happened in it.
    render(<MobileNav />);
    const panel = openPanelHere();
    fireEvent.click(within(panel).getByRole("link", { name: "index" }), {
      metaKey: true,
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on keyboard activation of a destination (Enter dispatches a click)", () => {
    render(<MobileNav />);
    const panel = openPanelHere();
    const link = within(panel).getByRole("link", { name: "now" });
    link.focus();
    // jsdom does not synthesize click from Enter on anchors; dispatch the click the browser
    // would, from the keyboard-focused element.
    fireEvent.click(link);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("MobileNav — focus and scroll-lock restoration", () => {
  it("moves focus INTO the panel on open (no focus stranded behind the modal)", () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /open menu/i });
    trigger.focus();
    const panel = openPanelHere();
    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it("returns focus to the trigger on Escape", async () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /open menu/i });
    trigger.focus();
    const panel = openPanelHere();
    fireEvent.keyDown(panel, { key: "Escape" });
    // Radix's onCloseAutoFocus refocuses the trigger a tick after unmount.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("wires the disclosure state onto the trigger (aria-expanded flips with the panel)", () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /open menu/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("locks body scroll while open (the commit claims Dialog 'brings the scroll lock')", () => {
    // Radix mounts `react-remove-scroll` on Dialog.OVERLAY, not on Content
    // (@radix-ui/react-dialog/dist/index.mjs, DialogOverlayImpl: "Make sure Content is
    // scrollable even when it doesn't live inside RemoveScroll") — and this panel renders no
    // Overlay. Verified with an Overlay mounted, the lock is observable as
    // `body[data-scroll-locked]` + an injected `overflow: hidden !important` sheet; without
    // one, NEITHER appears. In a real browser the panel's 5-item list doesn't overflow, so a
    // wheel/touch scroll over it CHAINS to the document — the page behind the modal scrolls,
    // and the user finds it somewhere else on close.
    render(<MobileNav />);
    const panel = openPanelHere();
    expect(document.body).toHaveAttribute("data-scroll-locked");
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
  });

  it("survives an open→close→reopen cycle (state machine is re-entrant)", () => {
    render(<MobileNav />);
    const panel = openPanelHere();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    const reopened = openPanelHere();
    expect(reopened).toHaveAccessibleName("Site navigation");
    fireEvent.click(
      within(reopened).getByRole("button", { name: /close menu/i }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

/**
 * The slice's own source-reading pins have two blind spots: a regex that matches ZERO
 * keyframes blocks passes its loop vacuously, and the reduced-motion check greps a raw
 * string, which a comment satisfies. These pins close both, structurally (postcss walks
 * live nodes only).
 */
describe("MobileNav source pins — closing the vacuous-pass holes", () => {
  const cssPath = resolve(
    process.cwd(),
    "src/components/site-chrome/MobileNav.module.css",
  );
  const css = readFileSync(cssPath, "utf8");

  it("the panel keyframes the anti-transform test scans actually EXIST under those names", () => {
    // MobileNav.test.tsx iterates `css.match(/@keyframes panel-(in|out)…/g) ?? []` — rename
    // the keyframes and that loop runs zero times, green. This pin fails the rename instead.
    const names: string[] = [];
    postcss.parse(css).walkAtRules("keyframes", (atRule) => {
      names.push(atRule.params);
    });
    expect(names).toEqual(
      expect.arrayContaining(["panel-in", "panel-out", "nav-in"]),
    );
  });

  it("NO live declaration in panel-in/panel-out sets transform, in ANY step", () => {
    // The author's regex only reaches the first two inner blocks of each keyframes rule; a
    // transform added in a later step escapes it. Walk every live declaration instead.
    postcss.parse(css).walkAtRules("keyframes", (atRule) => {
      if (!/^panel-(in|out)$/.test(atRule.params)) return;
      atRule.walkDecls((decl) => {
        expect(
          decl.prop,
          `${atRule.params} must not move the bar (found ${decl.prop})`,
        ).not.toMatch(/transform|translate|scale|rotate/);
      });
    });
  });

  it("the reduced-motion override is a LIVE `animation: none` on all three animated selectors", () => {
    // The author's check greps the raw source after "prefers-reduced-motion" — a comment
    // containing `animation: none` satisfies it. Walk the media block's live rules instead.
    const selectors = new Map<string, string>();
    postcss.parse(css).walkAtRules("media", (atRule) => {
      if (!atRule.params.includes("prefers-reduced-motion")) return;
      atRule.walkRules((rule) => {
        rule.walkDecls("animation", (decl) => {
          for (const s of rule.selectors) selectors.set(s.trim(), decl.value);
        });
      });
    });
    expect(selectors.get('.panel[data-state="open"]')).toBe("none");
    expect(selectors.get('.panel[data-state="closed"]')).toBe("none");
    expect(selectors.get('.panel[data-state="open"] .nav')).toBe("none");
  });

  it("the reduced-motion selectors MATCH the animated ones (an override aimed at a renamed selector is dead)", () => {
    // If the animated rules gain a selector (say `.panel[data-state="open"] .barRow`) without
    // the media block following, motion leaks past the preference. Derive both sets and diff.
    const animated = new Set<string>();
    const overridden = new Set<string>();
    postcss.parse(css).walkRules((rule) => {
      const inReducedMotion =
        rule.parent?.type === "atrule" &&
        (rule.parent as postcss.AtRule).params.includes(
          "prefers-reduced-motion",
        );
      rule.walkDecls(/^animation/, () => {
        for (const s of rule.selectors) {
          (inReducedMotion ? overridden : animated).add(s.trim());
        }
      });
    });
    expect([...animated].filter((s) => !overridden.has(s))).toEqual([]);
  });
});

/**
 * The claim-6 arithmetic: the header's fluid top padding interpolates 1rem→2rem over the
 * SAME 320px→1280px range as the type scale. jsdom computes nothing, so evaluate the clamp's
 * linear expression at both endpoints numerically against the tokens it claims to meet.
 */
describe("SiteNav fluid padding — the clamp meets its endpoints at 320px and 1280px", () => {
  const siteNavCss = readModuleCss(
    "src/components/site-chrome/SiteNav.module.css",
  );
  const mobileCss = readModuleCss(
    "src/components/site-chrome/MobileNav.module.css",
  );
  const spaceCss = readModuleCss("src/styles/foundation/space.css");

  const clampParts = (
    value: string,
  ): { min: number; interceptRem: number; slopeVw: number; max: number } => {
    const m =
      /clamp\(\s*var\(--space-(\d)\)\s*,\s*([\d.]+)rem\s*\+\s*([\d.]+)vw\s*,\s*var\(--space-(\d)\)\s*\)/.exec(
        value.replace(/\s+/g, " "),
      );
    expect(m, `expected a rem+vw clamp, got: ${value}`).not.toBeNull();
    const space = (n: string): number => {
      const v = new RegExp(`--space-${n}:\\s*([\\d.]+)rem`).exec(spaceCss)?.[1];
      expect(v, `--space-${n} must exist`).toBeDefined();
      return Number(v);
    };
    const [, minTok, intercept, slope, maxTok] = m as RegExpExecArray;
    return {
      min: space(minTok),
      interceptRem: Number(intercept),
      slopeVw: Number(slope),
      max: space(maxTok),
    };
  };

  it.each([
    [
      "SiteNav .header",
      ruleDeclarations(siteNavCss, ".header").get(
        "--site-nav-pad-block-start",
      ) ?? "",
    ],
    [
      "MobileNav .barRow",
      ruleDeclarations(mobileCss, ".barRow").get(
        "--mobile-nav-pad-block-start",
      ) ?? "",
    ],
  ])("%s hits its floor at 320px and its ceiling at 1280px", (_name, value) => {
    const { min, interceptRem, slopeVw, max } = clampParts(value);
    // 320px = 20rem of viewport; 1vw = 0.2rem. 1280px = 80rem; 1vw = 0.8rem.
    const at320 = interceptRem + slopeVw * 0.2;
    const at1280 = interceptRem + slopeVw * 0.8;
    expect(at320).toBeCloseTo(min, 3);
    expect(at1280).toBeCloseTo(max, 3);
    expect(max).toBeGreaterThan(min);
  });
});

/**
 * Claim 5's numeric premise: the panel's gutter inset equals the header lane's start ONLY
 * while the wide lane is pinned to the gutter — i.e. while the viewport is narrower than
 * `--width-wide` + 2 gutters. The container threshold (28rem row) must sit far inside that,
 * or the panel could show while the header is centered elsewhere. Pin the inequality on the
 * real tokens so a future --width-wide or gutter change re-proves it.
 */
describe("MobileNav gutter alignment — the threshold sits inside the gutter-pinned range", () => {
  it("panel-showing widths are all below the point where the wide lane leaves the gutter", () => {
    const dimension = readModuleCss("src/styles/foundation/dimension.css");
    const spaceSemantic = readModuleCss("src/styles/semantic/space.css");
    const spaceFoundation = readModuleCss("src/styles/foundation/space.css");
    const siteNavCss = readModuleCss(
      "src/components/site-chrome/SiteNav.module.css",
    );

    const wideRem = Number(/--width-wide:\s*([\d.]+)rem/.exec(dimension)?.[1]);
    const gutterTok = /--space-gutter:\s*var\(--space-(\d)\)/.exec(
      spaceSemantic,
    )?.[1];
    const gutterRem = Number(
      new RegExp(`--space-${gutterTok}:\\s*([\\d.]+)rem`).exec(
        spaceFoundation,
      )?.[1],
    );
    const thresholdRem = Number(
      /@container\s+site-nav\s*\(min-width:\s*([\d.]+)rem\)/.exec(
        siteNavCss,
      )?.[1],
    );

    expect(wideRem).toBeGreaterThan(0);
    expect(gutterRem).toBeGreaterThan(0);
    expect(thresholdRem).toBeGreaterThan(0);
    // The panel shows while the row (wide lane) < threshold, i.e. viewport < threshold +
    // 2 gutters. The lane starts at exactly one gutter while viewport ≤ wide + 2 gutters.
    expect(thresholdRem + 2 * gutterRem).toBeLessThanOrEqual(
      wideRem + 2 * gutterRem,
    );
  });
});
