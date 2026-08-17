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

  it("renders the tended date inside the meta readout as a <time> with the machine value", () => {
    renderInList(<EntrySummary title="Update" tended="2026-07-01" />);
    const time = screen.getByText("Last tended July 1, 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-07-01");
  });

  it("renders the stage as plain meta text — no badge treatment, no data-stage hook", () => {
    renderInList(<EntrySummary title="Entry" stage="budding" />);
    const stage = screen.getByText("Budding");
    expect(stage).not.toHaveAttribute("data-stage");
    expect(stage.closest("p")).toHaveAttribute("data-variant", "meta");
  });

  it("renders the summary and the backlink hint when present", () => {
    renderInList(
      <EntrySummary title="Entry" summary="A short summary." linkCount={3} />,
    );
    expect(screen.getByText("A short summary.")).toBeInTheDocument();
    expect(screen.getByText("3 Related")).toBeInTheDocument();
  });

  it("renders none of the optional pieces when their fields are absent or empty", () => {
    renderInList(
      <EntrySummary
        title="Bare"
        slug={null}
        summary={null}
        stage={null}
        tended={null}
        linkCount={0}
      />,
    );
    const item = screen.getByRole("listitem");
    // Just the heading — no time, no stage, no summary, no "0 Related". (The hint label
    // renamed linked → Related; guard both so the assertion never goes vacuous again.)
    expect(item.querySelector("time")).toBeNull();
    expect(screen.queryByText(/(linked|related)/i)).not.toBeInTheDocument();
    expect(item.textContent).toBe("Bare");
  });

  it("hides the backlink hint for a negative or null linkCount (bad upstream data stays invisible)", () => {
    render(
      <ul>
        <EntrySummary title="Negative" linkCount={-2} />
        <EntrySummary title="Nullish" linkCount={null} />
      </ul>,
    );
    expect(screen.queryByText(/(linked|related)/i)).not.toBeInTheDocument();
  });

  it("renders plain text for an empty-string slug — no dead link to '/'", () => {
    renderInList(<EntrySummary title="Slugless" slug="" />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Slugless" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides the stage and summary for empty strings, not just null", () => {
    renderInList(<EntrySummary title="Empty" stage="" summary="" />);
    const item = screen.getByRole("listitem");
    expect(item.textContent).toBe("Empty");
  });

  it("orders the row title → summary → meta readout, each its own block", () => {
    renderInList(
      <EntrySummary
        title="Ordered"
        summary="The summary."
        stage="evergreen"
        tended="2026-07-01"
        linkCount={2}
      />,
    );
    const item = screen.getByRole("listitem");
    const children = Array.from(item.children);
    // The row's three blocks, in order: the h3 title, its summary paragraph, the meta readout.
    expect(children).toHaveLength(3);
    expect(children[0].tagName).toBe("H3");
    expect(children[0].textContent).toBe("Ordered");
    expect(children[1].tagName).toBe("P");
    expect(children[1].textContent).toBe("The summary.");
    expect(children[1]).toHaveAttribute("data-variant", "body");
    expect(children[2]).toHaveAttribute("data-variant", "meta");
  });

  it("wears the editorial ink roles — foreground title, muted summary", () => {
    renderInList(<EntrySummary title="Inked" summary="The summary." />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveAttribute(
      "data-color",
      "foreground",
    );
    expect(screen.getByText("The summary.")).toHaveAttribute(
      "data-color",
      "muted-foreground",
    );
  });

  describe("adversarial QA", () => {
    it("merges the quiet treatment onto the title's single anchor — no nested/second anchor", () => {
      renderInList(<EntrySummary title="Merged" slug="merged" />);
      // A Slot that failed to merge would leave <a><a>…</a></a> (invalid HTML the browser
      // re-parents) or a styleless link; exactly one anchor must carry the treatment.
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("data-variant", "quiet");
      expect(links[0]).toHaveAttribute("href", "/merged");
    });

    it("keeps the treated anchor inside the h3 (heading link stays a heading link)", () => {
      renderInList(<EntrySummary title="Nested" slug="nested" />);
      const heading = screen.getByRole("heading", { level: 3 });
      const link = screen.getByRole("link", { name: "Nested" });
      expect(heading).toContainElement(link);
    });
  });
});
