import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntrySummary from "./EntrySummary";

// Always rendered inside the consumer's <ul>; mirror that so the <li> is valid and the
// listitem role is queryable.
function renderInList(ui: React.ReactElement) {
  return render(<ul>{ui}</ul>);
}

describe("EntrySummary", () => {
  it("renders a list item titled by an h3 that links to the flat /[slug]", () => {
    renderInList(<EntrySummary title="Palette Studio" slug="palette-studio" />);
    expect(screen.getByRole("listitem")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Palette Studio" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Palette Studio" }),
    ).toHaveAttribute("href", "/palette-studio");
  });

  it("renders the title as plain text when there is no slug — no dead link", () => {
    renderInList(<EntrySummary title="Draft entry" slug={null} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Draft entry" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the date kicker as a <time> carrying the machine value", () => {
    renderInList(
      <EntrySummary
        title="Update"
        date={{ dateTime: "2026-07-01", label: "July 1, 2026" }}
      />,
    );
    const time = screen.getByText("July 1, 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-07-01");
  });

  it("renders the stage badge stamped with data-stage", () => {
    renderInList(<EntrySummary title="Entry" stage="budding" />);
    const badge = screen.getByText("budding");
    expect(badge).toHaveAttribute("data-stage", "budding");
  });

  it("renders the blurb and the backlink hint when present", () => {
    renderInList(
      <EntrySummary title="Entry" blurb="A short summary." linkCount={3} />,
    );
    expect(screen.getByText("A short summary.")).toBeInTheDocument();
    expect(screen.getByText("3 linked")).toBeInTheDocument();
  });

  it("renders none of the optional pieces when their fields are absent or empty", () => {
    renderInList(
      <EntrySummary
        title="Bare"
        slug={null}
        blurb={null}
        stage={null}
        date={null}
        linkCount={0}
      />,
    );
    const item = screen.getByRole("listitem");
    // Just the heading — no time, no badge, no blurb, no "0 linked".
    expect(item.querySelector("time")).toBeNull();
    expect(screen.queryByText(/linked/)).not.toBeInTheDocument();
    expect(item.textContent).toBe("Bare");
  });

  it("hides the backlink hint for a negative or null linkCount (bad upstream data stays invisible)", () => {
    render(
      <ul>
        <EntrySummary title="Negative" linkCount={-2} />
        <EntrySummary title="Nullish" linkCount={null} />
      </ul>,
    );
    expect(screen.queryByText(/linked/)).not.toBeInTheDocument();
  });

  it("renders plain text for an empty-string slug — no dead link to '/'", () => {
    renderInList(<EntrySummary title="Slugless" slug="" />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Slugless" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides the stage badge and blurb for empty strings, not just null", () => {
    renderInList(<EntrySummary title="Empty" stage="" blurb="" />);
    const item = screen.getByRole("listitem");
    expect(item.querySelector("[data-stage]")).toBeNull();
    expect(item.textContent).toBe("Empty");
  });
});
