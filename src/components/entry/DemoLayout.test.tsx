import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DemoLayout from "./DemoLayout";

const baseProps = {
  title: "OKLCH Engine",
  summary: "Feed the engine a seed.",
  kind: "demo",
  stage: "prototype",
  iterated: { dateTime: "2026-07-16", label: "July 16, 2026" },
  seed: "oklch(0.66 0.2 350)",
};

describe("DemoLayout", () => {
  it("renders the page-owned sidebar info: h1 title, summary, and the mono readout", () => {
    render(<DemoLayout {...baseProps}>canvas</DemoLayout>);
    expect(
      screen.getByRole("heading", { level: 1, name: /oklch engine/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Feed the engine a seed.")).toBeInTheDocument();
    expect(screen.getByText("demo · prototype")).toBeInTheDocument();
    expect(screen.getByText("oklch(0.66 0.2 350)")).toBeInTheDocument();
  });

  it("stamps the iterated fact as a real <time> with the machine value", () => {
    render(<DemoLayout {...baseProps}>canvas</DemoLayout>);
    const time = screen.getByText(/iterated July 16, 2026/);
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-07-16");
  });

  it("mounts the module's controls and the canvas children", () => {
    render(
      <DemoLayout
        {...baseProps}
        controls={<button type="button">Randomize</button>}
      >
        <div data-testid="the-canvas">canvas surface</div>
      </DemoLayout>,
    );
    expect(
      screen.getByRole("button", { name: /randomize/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("the-canvas")).toBeInTheDocument();
  });

  it("omits every absent fact without leaving empty rows", () => {
    render(
      <DemoLayout title="Bare">
        <div>canvas</div>
      </DemoLayout>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Bare" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/iterated/)).not.toBeInTheDocument();
  });
});

describe("DemoLayout.module.css — the template's layout contract", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/entry/DemoLayout.module.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("claims no lane of its own — the consumer's bleed wrapper owns grid placement", () => {
    // A lane declaration here would be inert anyway (the scope's [data-entry] wrapper sits
    // between this section and the page grid) — pinning its absence keeps the false sense of
    // placement from coming back.
    expect(css).not.toMatch(/grid-column/);
  });

  it("reflows intrinsically — no @media / @custom-media (flex + wrap owns the stacking)", () => {
    expect(css).not.toMatch(/@media/);
    expect(css).not.toMatch(/@custom-media/);
    expect(css).toMatch(/flex-wrap:\s*wrap/);
  });

  it("draws the region divider as the gap, never a directional border", () => {
    // A border-inline-end on the sidebar becomes a stray edge line (and no divider) when the
    // pair stacks — the gap + container background reads correctly in BOTH orientations.
    expect(css).toMatch(/gap:\s*var\(--border-width\)/);
    expect(css).toMatch(/background:\s*var\(--border\)/);
    expect(css).not.toMatch(/border-inline-end|border-right/);
  });
});
