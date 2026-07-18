import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryMeta from "./EntryMeta";

const fullProps = {
  kind: "demo",
  stage: "prototype",
  iterated: "2026-07-16",
  seed: "oklch(0.66 0.2 350)",
  linkCount: 3,
};

describe("EntryMeta", () => {
  it("renders every fact in the fixed order: kind · stage · iterated · seed · linked", () => {
    const { container } = render(<EntryMeta {...fullProps} />);
    const texts = Array.from(container.querySelectorAll("span, time"))
      .map((el) => el.textContent)
      .filter((text) => text !== "·");
    expect(texts).toEqual([
      "demo",
      "prototype",
      "iterated July 16, 2026",
      "oklch(0.66 0.2 350)",
      "3 linked",
    ]);
  });

  it("separates facts with decorative dots hidden from assistive tech", () => {
    const { container } = render(<EntryMeta {...fullProps} />);
    const separators = container.querySelectorAll('[aria-hidden="true"]');
    // One separator between each adjacent pair of the five facts.
    expect(separators).toHaveLength(4);
    for (const separator of separators) {
      expect(separator.textContent).toBe("·");
    }
  });

  it("stamps the iterated fact as a real <time> carrying the machine value", () => {
    render(<EntryMeta iterated="2026-07-16" />);
    const time = screen.getByText("iterated July 16, 2026");
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
      <EntryMeta kind="" stage="" iterated="" seed="" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("drops a malformed iterated date rather than rendering garbage", () => {
    const { container } = render(
      <EntryMeta kind="note" iterated="not-a-date" />,
    );
    expect(container.textContent).toBe("note");
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
    expect(container.textContent).not.toContain("linked");
  });

  it("renders a lone fact with no separators", () => {
    const { container } = render(<EntryMeta stage="shipped" />);
    expect(container.textContent).toBe("shipped");
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
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
