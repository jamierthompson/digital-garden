import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { readModuleCss, ruleDeclarations } from "../../../tests/cssModule";

import styles from "./MobileNav.module.css";
import MobileNav from "./MobileNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

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

  it("renders an Overlay, which is what carries the scroll lock", () => {
    // Radix mounts `RemoveScroll` inside `DialogOverlayImpl` only — never in the content. With
    // content alone the panel opens and the page underneath keeps scrolling, and nothing in the
    // rendered output reveals it.
    openPanel();
    expect(document.querySelector(`.${styles.overlay}`)).toBeInTheDocument();
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

  it("closes when the panel's LOGO is activated — it is a link out too", () => {
    // The panel duplicates the header's bar, so it duplicates the bar's home link. Wiring only
    // the five destinations leaves the sixth link navigating home UNDER a still-open panel.
    const panel = openPanel();
    fireEvent.click(
      within(panel).getByRole("link", { name: /jamie thompson/i }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open on a modified click, which does not navigate this page", () => {
    // cmd/ctrl-click opens a new tab and leaves this page where it is, so closing the panel
    // would dismiss it for a navigation that never happened here.
    const panel = openPanel();
    fireEvent.click(within(panel).getByRole("link", { name: "about" }), {
      metaKey: true,
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("does not translate the panel — the bar must not move on open", () => {
    // A transform on the panel carries the duplicated bar with it, so the mark and toggle slide
    // even though their whole purpose is to stay put. Motion belongs on the list.
    const css1 = css.replace(/\s+/g, " ");
    const blocks = css1.match(/@keyframes panel-(in|out) \{[^}]*\}[^}]*\}/g);
    // Assert the match FOUND something first: iterating `?? []` passes vacuously the moment the
    // keyframes are renamed, which is exactly when this check matters most.
    expect(blocks).toHaveLength(2);
    for (const block of blocks ?? []) expect(block).not.toContain("transform");
    expect(css1).toMatch(/@keyframes nav-in \{[^}]*transform/);
  });

  it("insets by the gutter, where the header's contents begin", () => {
    // Below the band's 28rem threshold the header's `wide` lane starts exactly one gutter from
    // the edge, so this is what keeps the bar from moving sideways as the panel opens.
    expect(ruleDeclarations(css, ".panel").get("--mobile-nav-inset")).toBe(
      "var(--space-gutter)",
    );
    expect(ruleDeclarations(css, ".panel").get("padding-inline-start")).toBe(
      "var(--mobile-nav-inset)",
    );
    expect(ruleDeclarations(siteNavCss, ".row").get("grid-column")).toBe(
      "wide",
    );
  });

  it("compensates the trailing edge for the scrollbar the lock removes", () => {
    // The scroll lock hides the scrollbar, widening the viewport. `react-remove-scroll` pads the
    // BODY to keep in-flow content still, which a `position: fixed` panel never receives — so
    // without this the bar's right-hand controls land a scrollbar-width right of the header's,
    // on exactly the platforms with classic scrollbars. Fallback required: the package's own
    // source documents the variable as possibly undefined.
    const panel = ruleDeclarations(css, ".panel");
    expect(panel.get("--mobile-nav-scrollbar")).toBe(
      "var(--removed-body-scroll-bar-size, 0px)",
    );
    expect(panel.get("padding-inline-end")?.replace(/\s+/g, " ")).toBe(
      "calc( var(--mobile-nav-inset) + var(--mobile-nav-scrollbar) )",
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

  it("drops the animation under prefers-reduced-motion", () => {
    // `animation: none` is also what lets Radix unmount immediately — it reads the computed
    // `animationName`, sees `none`, and stops waiting for an `animationend` that never fires.
    // Without this the panel would hang on screen for reduced-motion users.
    // Comments are stripped first: a prose mention of `animation: none` in a comment would
    // otherwise satisfy this grep while the declaration itself was gone.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, " ");
    expect(bare).toMatch(/prefers-reduced-motion:\s*reduce/);
    const reduced = bare
      .split("prefers-reduced-motion")[1]
      ?.replace(/\s+/g, " ");
    expect(reduced).toContain("animation: none");
    // Every animated selector must be released, not just the panel — a nav left animating would
    // keep Presence waiting for an `animationend` that the media query prevented.
    for (const selector of [
      '.panel[data-state="open"]',
      '.panel[data-state="closed"]',
      '.panel[data-state="open"] .nav',
    ]) {
      expect(reduced).toContain(selector);
    }
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
