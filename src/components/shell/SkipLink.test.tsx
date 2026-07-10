import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MAIN_CONTENT_ID } from "@/lib/landmarks";

import SkipLink from "./SkipLink";

describe("SkipLink", () => {
  it("renders a link to the main-content landmark", () => {
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: /skip to content/i });
    // The anchor must resolve to the id every view's <main> carries (WCAG 2.4.1) — a mismatch
    // here silently turns the skip-link into a dead anchor, so pin it to the shared constant.
    expect(link).toHaveAttribute("href", `#${MAIN_CONTENT_ID}`);
  });
});
