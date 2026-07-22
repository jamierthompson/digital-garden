import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryMeta from "./EntryMeta";

const fullProps = {
  kind: "demo",
  stage: "budding",
  tended: "2026-07-16",
  seed: "oklch(0.66 0.2 350)",
  linkCount: 3,
};

describe("EntryMeta", () => {
  it("renders every fact in the fixed order: kind · stage · tended · seed · linked", () => {
    const { container } = render(<EntryMeta {...fullProps} />);
    // Facts are the spans inside the track wrapper (p > track > fact).
    const facts = Array.from(container.querySelectorAll("p > span > span")).map(
      (el) => el.textContent,
    );
    expect(facts).toEqual([
      "Demo",
      "Budding",
      "Last tended July 16, 2026",
      "oklch(0.66 0.2 350)",
      "3 Related",
    ]);
  });

  it("renders NO separator elements — the dots are CSS-generated inside each fact (QA #329 D1)", () => {
    // A separator that is its own flex item can wrap alone, stranding a dangling "·" at a
    // line end. The dot must live in the following fact's ::before so it travels with it.
    const { container } = render(<EntryMeta {...fullProps} />);
    expect(container.textContent).not.toContain("·");
    expect(container.querySelectorAll("[aria-hidden]")).toHaveLength(0);
  });

  it("stamps the tended fact as a real <time> carrying the machine value", () => {
    render(<EntryMeta tended="2026-07-16" />);
    const time = screen.getByText("Last tended July 16, 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-07-16");
  });

  it("wears the meta type role on a single <p>", () => {
    const { container } = render(<EntryMeta {...fullProps} />);
    const paragraph = container.querySelector("p");
    expect(paragraph).toHaveAttribute("data-variant", "meta");
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renders nothing at all when no fact is present", () => {
    const { container } = render(<EntryMeta />);
    expect(container).toBeEmptyDOMElement();
  });

  it("treats empty strings as absent — never an empty fact or a stray dot", () => {
    const { container } = render(
      <EntryMeta kind="" stage="" tended="" seed="" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("drops a malformed tended date rather than rendering garbage", () => {
    const { container } = render(<EntryMeta kind="note" tended="not-a-date" />);
    expect(container.textContent).toBe("Note");
    expect(container.querySelector("time")).toBeNull();
  });

  it("shows the link hint only for a positive count — 0, null, and negative stay silent", () => {
    const { container } = render(
      <>
        <EntryMeta kind="note" linkCount={0} />
        <EntryMeta kind="note" linkCount={null} />
        <EntryMeta kind="note" linkCount={-2} />
      </>,
    );
    expect(container.textContent).not.toMatch(/linked/i);
  });

  it("renders a lone fact with no separators", () => {
    const { container } = render(<EntryMeta stage="evergreen" />);
    expect(container.textContent).toBe("Evergreen");
  });

  it("passes the ink role through to the type primitive; omitting it inherits the ambient ink", () => {
    const { container: colored } = render(
      <EntryMeta kind="note" color="muted-foreground" />,
    );
    expect(colored.querySelector("p")).toHaveAttribute(
      "data-color",
      "muted-foreground",
    );
    const { container: ambient } = render(<EntryMeta kind="note" />);
    expect(ambient.querySelector("p")).not.toHaveAttribute("data-color");
  });

  it("merges a caller className onto the readout", () => {
    const { container } = render(
      <EntryMeta kind="note" className="from-caller" />,
    );
    expect(container.querySelector("p")?.className).toContain("from-caller");
  });
});

describe("EntryMeta.module.css — the separator contract (QA #329 D1)", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/entry/EntryMeta.module.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  // jsdom doesn't paint ::before or clip overflow, so the wrap-safety design is pinned as a
  // CSS contract; the painted result is the browser QA pass's job.
  it("generates the dot on EVERY fact (not just after the first), marked decorative via content alt text", () => {
    // A `.fact + .fact` (or `::after`) attachment strands a dot at a wrap boundary — the
    // clip design needs the dot on every fact so the track shift can hide each line's leader.
    expect(css).toMatch(/\.fact::before/);
    expect(css).not.toMatch(/\.fact \+ \.fact/);
    expect(css).not.toMatch(/::after/);
    expect(css).toMatch(/content:\s*"·"\s*\/\s*""/);
  });

  it("clips each line's leading dot: overflow clip on the box, exact negative shift on the track", () => {
    expect(css).toMatch(/overflow:\s*clip/);
    // The shift must account for the dot's TRUE advance plus both gap margins. The dot rides
    // in a fixed box (an atomic inline advances by its own inline-size, not the glyph's
    // face-specific advance), so advance = box + the meta role's tracking is exact in ANY
    // face — a bare glyph would make the shift a face-coupled measurement.
    expect(css).toMatch(/--entry-meta-dot-box:\s*1ch/);
    expect(css).toMatch(
      /--entry-meta-dot-advance:\s*calc\(\s*var\(--entry-meta-dot-box\) \+ var\(--type-meta-tracking\)\s*\)/,
    );
    expect(css).toMatch(
      /margin-inline-start:\s*calc\(\s*-1 \*\s*\(var\(--entry-meta-dot-advance\) \+ 2 \* var\(--entry-meta-gap\)\)\s*\)/,
    );
    expect(css).toMatch(/margin-inline:\s*var\(--entry-meta-gap\)/);
    // The fixed box itself: inline-block + the box token as inline-size, dot centered.
    expect(css).toMatch(/display:\s*inline-block/);
    expect(css).toMatch(/inline-size:\s*var\(--entry-meta-dot-box\)/);
  });
});

describe("EntryMeta — adversarial QA (#329)", () => {
  it("treats whitespace-only facts as absent — no invisible fact, no stray separator dot", () => {
    // A whitespace-only fact would still mint a `.fact` wrapper, and the CSS-generated dot
    // on an invisible fact renders as a stray "·" — so the pin is on the fact COUNT.
    const { container } = render(
      <EntryMeta kind="   " stage="evergreen" seed={"\t"} />,
    );
    const facts = container.querySelectorAll("p > span > span");
    expect(facts).toHaveLength(1);
    expect(facts[0].textContent).toBe("Evergreen");
  });

  it("renders nothing (and never throws) when every fact is whitespace-only", () => {
    const { container } = render(<EntryMeta kind=" " stage="  " seed={"\n"} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("never throws on non-string facts — numbers, objects, arrays, booleans degrade to absence", () => {
    const hostile = {
      kind: 42 as unknown as string,
      stage: { evil: true } as unknown as string,
      tended: ["2026-07-16"] as unknown as string,
      seed: false as unknown as string,
      linkCount: { valueOf: () => 3 } as unknown as number,
    };
    const { container } = render(<EntryMeta {...hostile} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps a NaN linkCount silent (typeof NaN === 'number', but it is not positive)", () => {
    const { container } = render(
      <EntryMeta kind="note" linkCount={Number.NaN} />,
    );
    expect(container.textContent).toBe("Note");
  });

  it("drops a calendar-impossible tended date (round-trip guard) rather than rolling it over", () => {
    const { container } = render(<EntryMeta kind="note" tended="2026-02-30" />);
    expect(container.textContent).toBe("Note");
    expect(container.querySelector("time")).toBeNull();
  });

  it("drops a datetime-shaped tended value (the contract is a date-only ISO string)", () => {
    const { container } = render(
      <EntryMeta kind="note" tended="2026-07-16T12:00:00Z" />,
    );
    expect(container.textContent).toBe("Note");
    expect(container.querySelector("time")).toBeNull();
  });

  it("surfaces an XSS-shaped seed as inert text, never markup", () => {
    render(<EntryMeta seed={'"><img src=x onerror=alert(1)>'} />);
    expect(document.querySelector("img")).toBeNull();
    expect(
      screen.getByText('"><img src=x onerror=alert(1)>'),
    ).toBeInTheDocument();
  });
});

// QA (font-palette, commit 572a48d): capitalization moved from `text-transform: capitalize`
// (CSS) INTO CONTENT — the human-language facts are capitalized at render by a `capitalize()`
// helper so selection/copy/AT read what the eye reads. The owner explicitly called out the
// regression the old CSS caused: it blindly rewrote the seed DATA LITERAL to "Oklch(…)". These
// pin the new contract's edges.
describe("EntryMeta — capitalize-in-content (owner ruling: display case = copy case)", () => {
  it("leaves the seed a VERBATIM data literal — never 'Oklch(…)' (the regression the ruling fixed)", () => {
    // The seed begins with a lowercase letter `capitalize()` WOULD uppercase; it must be exempt.
    render(<EntryMeta seed="oklch(0.66 0.2 350)" />);
    const seed = screen.getByText("oklch(0.66 0.2 350)");
    expect(seed.textContent).toBe("oklch(0.66 0.2 350)");
    // And it is a real content string (copyable / in the accessible name), not a CSS illusion.
    expect(screen.queryByText("Oklch(0.66 0.2 350)")).toBeNull();
  });

  it("capitalizes kind/stage/links/tended IN the DOM text (copyable), carrying no text-transform", () => {
    const { container } = render(
      <EntryMeta
        kind="demo"
        stage="evergreen"
        tended="2026-07-16"
        linkCount={7}
      />,
    );
    // The capital is in the actual text node — selection & AT get "Demo", not "demo".
    expect(screen.getByText("Demo").textContent).toBe("Demo");
    expect(screen.getByText("Evergreen").textContent).toBe("Evergreen");
    expect(screen.getByText("Last tended July 16, 2026")).toBeInTheDocument();
    expect(screen.getByText("7 Related").textContent).toBe("7 Related");
    // No module rule re-introduced the transform (would double-case / desync copy from display).
    expect(container.querySelector("p")?.className).not.toMatch(/uppercase/);
  });

  it("is idempotent — an already-capitalized authored fact is not double-processed", () => {
    render(<EntryMeta kind="Demo" stage="Evergreen" />);
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByText("Evergreen")).toBeInTheDocument();
  });

  it("capitalizes a non-ASCII first letter without corruption (ñ → Ñ)", () => {
    render(<EntryMeta kind="ñoño" />);
    expect(screen.getByText("Ñoño").textContent).toBe("Ñoño");
  });

  it("never corrupts an astral (surrogate-pair) first character — halves stay paired", () => {
    // `charAt(0)` splits a surrogate pair; a naive helper could re-emit a lone surrogate.
    // U+1D400 (𝐀) has no uppercase, so the fact must survive byte-for-byte, not mojibake.
    render(<EntryMeta kind="𝐀lpha" />);
    expect(screen.getByText("𝐀lpha").textContent).toBe("𝐀lpha");
  });

  it("sentence-cases a multi-word fact — first letter only, not per-word title case", () => {
    // Behavior pin, not an endorsement: the helper capitalizes the leading letter only, so a
    // multi-word kind renders "Case study" (the old CSS `capitalize` would have title-cased it
    // to "Case Study"). If the owner wants per-word case, this is the test to change.
    render(<EntryMeta kind="case study" stage="in review" />);
    expect(screen.getByText("Case study")).toBeInTheDocument();
    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(screen.queryByText("Case Study")).toBeNull();
  });

  it("does not crash on a single-character fact (charAt(0) === whole string)", () => {
    render(<EntryMeta kind="x" stage="y" />);
    expect(screen.getByText("X")).toBeInTheDocument();
    expect(screen.getByText("Y")).toBeInTheDocument();
  });
});
