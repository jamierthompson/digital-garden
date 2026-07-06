import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import HintPopover from "./HintPopover";

// Radix Popover positions via Popper, which needs these browser APIs jsdom lacks. Stubbed
// locally (not in the shared setup) so opening the popover doesn't throw.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});

function renderPopover() {
  return render(
    <HintPopover label="More about this" title="The details">
      <p>Explanatory body copy.</p>
    </HintPopover>,
  );
}

describe("HintPopover", () => {
  it("exposes a real trigger button named by its label; the ? glyph is decorative", () => {
    renderPopover();
    const trigger = screen.getByRole("button", { name: "More about this" });
    expect(trigger).toBeInTheDocument();
    // The "?" glyph is aria-hidden, so it never pollutes the accessible name.
    expect(trigger.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      "?",
    );
  });

  it("keeps the content closed until the trigger is activated", () => {
    renderPopover();
    expect(screen.queryByText("The details")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Explanatory body copy."),
    ).not.toBeInTheDocument();
  });

  it("opens the title and body on click", () => {
    renderPopover();
    fireEvent.click(screen.getByRole("button", { name: "More about this" }));
    expect(screen.getByText("The details")).toBeInTheDocument();
    expect(screen.getByText("Explanatory body copy.")).toBeInTheDocument();
  });

  it("dismisses on Escape (WCAG 1.4.13 dismissible)", () => {
    renderPopover();
    fireEvent.click(screen.getByRole("button", { name: "More about this" }));
    expect(screen.getByText("Explanatory body copy.")).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(
      screen.queryByText("Explanatory body copy."),
    ).not.toBeInTheDocument();
  });
});

// Adversarial QA (fresh, no prior context) — the focus-management edges the author's suite
// skipped. HintPopover deliberately splits behavior by input modality: a keyboard/click open
// MUST move focus into the content (so a keyboard user can reach it), while a mouse-hover open
// must NOT steal focus (`onOpenAutoFocus` is prevented while `hoverOpenedRef` is set). Both
// branches were untested.
describe("HintPopover · focus management", () => {
  it("moves focus INTO the popover content when opened by click (keyboard-reachable)", () => {
    renderPopover();
    fireEvent.click(screen.getByRole("button", { name: "More about this" }));
    const dialog = screen.getByRole("dialog");
    // Focus lands inside the opened content, not left on the trigger — a keyboard user can read it.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  // NOTE: focus RESTORATION on Escape (focus returns to the trigger) is Radix `FocusScope`
  // behavior that jsdom does not emulate (it relies on real focus-guard sentinels), so it is
  // verified in the browser pass, not here — asserting it in jsdom is a false negative.

  it("a mouse-hover open does NOT steal focus from elsewhere", () => {
    render(
      <>
        <button type="button">elsewhere</button>
        <HintPopover label="Hover me" title="Hovered">
          <p>Hover body.</p>
        </HintPopover>
      </>,
    );
    const elsewhere = screen.getByRole("button", { name: "elsewhere" });
    elsewhere.focus();
    expect(elsewhere).toHaveFocus();

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Hover me" }), {
      pointerType: "mouse",
    });

    // The content opens on hover…
    expect(screen.getByText("Hover body.")).toBeInTheDocument();
    // …but focus stays where the user left it (hover is a passive enhancement).
    expect(elsewhere).toHaveFocus();
  });

  it("a touch pointer-enter does NOT open the popover (click owns touch)", () => {
    renderPopover();
    fireEvent.pointerEnter(
      screen.getByRole("button", { name: "More about this" }),
      { pointerType: "touch" },
    );
    // Only mouse hover opens; touch/pen defer to the click toggle so hover never double-fires.
    expect(
      screen.queryByText("Explanatory body copy."),
    ).not.toBeInTheDocument();
  });
});

// A11y GAP (QA finding — currently FAILING; see QA-REPORT.md). Radix renders the popover content
// as role="dialog", but HintPopover never names it: with no aria-label/aria-labelledby, a screen
// reader entering the popover announces a nameless "dialog". WCAG 4.1.2 (Name, Role, Value) wants
// the dialog named. The title is already rendered — wiring `Popover.Content` with an
// `aria-labelledby` pointing at the title `<p>` (give it an id) is the standard, elegant fix.
describe("HintPopover · a11y gap (fails until the dialog is named)", () => {
  it("names the popover dialog (aria-label or aria-labelledby resolving to the title)", () => {
    renderPopover();
    fireEvent.click(screen.getByRole("button", { name: "More about this" }));
    // getByRole enforces an accessible NAME when one is queried; assert the dialog is named
    // "The details" (its title). Currently the dialog has no name → this fails.
    expect(
      screen.getByRole("dialog", { name: "The details" }),
    ).toBeInTheDocument();
  });
});
