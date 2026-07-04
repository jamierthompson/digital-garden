// Plain-language definitions for the terms of art the cards use (#154). The cards keep copy
// plain-first with inline glosses; the shared vocabulary is defined ONCE, in a page-level
// sidebar (`GlossarySidebar`), not repeated on every card. Friendly, everyday register — the
// owner's ask was "the ramp — the 11 shades we build from your color", that voice. Pure data.

export interface GlossaryEntry {
  /** The term as it appears on the cards. */
  readonly term: string;
  /** A one- or two-sentence friendly, plain definition. */
  readonly definition: string;
}

/** The full vocabulary, in the order it's worth reading top to bottom. Rendered once. */
export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    term: "Scale (ramp)",
    definition:
      "The 11 shades we build from your color, lightest to darkest — like a strip of paint chips. Every color on a card is picked from one of these.",
  },
  {
    term: "Shade",
    definition:
      "Each shade on a scale has a number, 50 (lightest) to 950 (darkest). A bigger number is a darker shade.",
  },
  {
    term: "Contrast ratio",
    definition:
      "The classic “is this readable?” score, from 1:1 to 21:1. Normal text needs at least 4.5:1; larger text, borders, and buttons need 3:1.",
  },
  {
    term: "Lc",
    definition:
      "A newer readability score (APCA) that's closer to how your eye actually reads, from 0 to about 106. Rough guide: body text wants around 75, larger text and UI around 45.",
  },
  {
    term: "Worst-case surface",
    definition:
      "The trickiest background a color has to sit on. If it reads clearly there, it reads clearly on every other surface too — that's how one check covers them all.",
  },
  {
    term: "Toned down (out of gamut)",
    definition:
      "A color too vivid for your screen to show. We gently tone it down to fit — the same thing your browser would do — before checking it's still readable, so the numbers match what you see.",
  },
];
