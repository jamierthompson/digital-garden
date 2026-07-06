// QA #131 — Panel contract: every slot's frame is a LABELLED region, so a screen-reader
// user can jump between the Color Engine's panels by landmark.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Panel from "./Panel";

describe("Panel", () => {
  it("renders a region landmark named by its label", () => {
    render(<Panel label="Seed">content</Panel>);
    expect(screen.getByRole("region", { name: "Seed" })).toBeInTheDocument();
  });

  it("renders its children inside the region", () => {
    render(
      <Panel label="Rules">
        <p>the rules body</p>
      </Panel>,
    );
    expect(screen.getByRole("region", { name: "Rules" })).toContainElement(
      screen.getByText("the rules body"),
    );
  });
});
