// QA #131 — PillTabList contract: a labelled tablist whose triggers expose
// aria-selected, wired through the consumer-owned Tabs.Root (the ExportTabs shape).

import { fireEvent, render, screen } from "@testing-library/react";
import { Tabs } from "radix-ui";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import PillTabList from "./PillTabList";

const TABS = [
  { id: "css", label: "CSS variables" },
  { id: "tailwind", label: "Tailwind" },
  { id: "json", label: "JSON" },
] as const;

function Harness() {
  const [tab, setTab] = useState("css");
  return (
    <Tabs.Root value={tab} onValueChange={setTab}>
      <PillTabList label="Export format" tabs={TABS} />
      {TABS.map((t) => (
        <Tabs.Content key={t.id} value={t.id}>
          {t.label} panel
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

describe("PillTabList", () => {
  it("renders a tablist named by its label with every tab", () => {
    render(<Harness />);
    const list = screen.getByRole("tablist", { name: "Export format" });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("marks the active tab aria-selected and shows its panel", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: "CSS variables" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("CSS variables panel")).toBeInTheDocument();
  });

  it("switches the selected tab and its panel on click", () => {
    render(<Harness />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "JSON" }));
    fireEvent.click(screen.getByRole("tab", { name: "JSON" }));
    expect(screen.getByRole("tab", { name: "JSON" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("JSON panel")).toBeInTheDocument();
    expect(screen.queryByText("CSS variables panel")).not.toBeInTheDocument();
  });

  it("associates each trigger with its panel (aria-controls)", () => {
    render(<Harness />);
    const active = screen.getByRole("tab", { name: "CSS variables" });
    const controls = active.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls as string)).toHaveTextContent(
      "CSS variables panel",
    );
  });
});
