import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTokenSet } from "@garden/oklch";
import ExportTabs from "./ExportTabs";

const set = buildTokenSet("#7c3aed");

describe("ExportTabs", () => {
  it("defaults to the CSS tab and shows engine-serialized output", () => {
    render(<ExportTabs tokenSet={set} />);
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText(/:root/)).toBeInTheDocument();
    expect(
      within(panel).getByText(/--accent: light-dark\(oklch\(/),
    ).toBeInTheDocument();
  });

  it("switches export target when another tab is selected", () => {
    render(<ExportTabs tokenSet={set} />);
    // Radix Tabs default to automatic activation (on focus), so focus the trigger.
    fireEvent.focus(screen.getByRole("tab", { name: "Tailwind theme" }));
    expect(
      within(screen.getByRole("tabpanel")).getByText(/@theme/),
    ).toBeInTheDocument();
    fireEvent.focus(screen.getByRole("tab", { name: "JSON tokens" }));
    expect(
      within(screen.getByRole("tabpanel")).getByText(/"\$type": "color"/),
    ).toBeInTheDocument();
  });

  it("reserializes in the chosen color format", () => {
    render(<ExportTabs tokenSet={set} />);
    fireEvent.click(screen.getByRole("radio", { name: "Hex" }));
    expect(
      within(screen.getByRole("tabpanel")).getByText(/--accent: light-dark\(#/),
    ).toBeInTheDocument();
  });

  it("copies the active output to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ExportTabs tokenSet={set} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledOnce();
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain("--accent: light-dark(oklch(");
    expect(copied).toContain(":root");
  });

  // QA-S4-2: hex/rgb are the sRGB rendering; the UI must disclose it (and the P3 clamp is
  // lossy). OKLCH is lossless, so no note there.
  it("discloses hex/rgb as the sRGB rendering, and never for OKLCH", () => {
    render(<ExportTabs tokenSet={set} />);
    // Default OKLCH — no note.
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    // Hex — the note appears.
    fireEvent.click(screen.getByRole("radio", { name: "Hex" }));
    expect(screen.getByRole("note")).toHaveTextContent(/sRGB rendering/i);
    // Back to OKLCH — the note is gone.
    fireEvent.click(screen.getByRole("radio", { name: "OKLCH" }));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("warns that hex/rgb clamp a P3 palette (lossy)", () => {
    render(<ExportTabs tokenSet={buildTokenSet("#7c3aed", { gamut: "p3" })} />);
    fireEvent.click(screen.getByRole("radio", { name: "RGB" }));
    expect(screen.getByRole("note")).toHaveTextContent(/P3.*sRGB|lossy/i);
  });
});

// Adversarial QA (#107 export slice) — the copy/download I/O paths the happy-path suite
// above skips: clipboard rejection (denied permission), non-secure context (no clipboard
// API), exact-bytes-per-active-tab, and the download filename/mime contract. Reuses the
// module-scope `set` fixture from the top of the file.

afterEach(() => {
  vi.restoreAllMocks();
  // Leave navigator.clipboard in a known-good state for the next test.
  Object.assign(navigator, { clipboard: undefined });
});

describe("ExportTabs — clipboard error paths", () => {
  it("does NOT throw when there is no clipboard API (non-secure context / old browser)", () => {
    Object.assign(navigator, { clipboard: undefined });
    render(<ExportTabs tokenSet={set} />);
    // The click must be a graceful no-op, never a synchronous crash.
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Copy" })),
    ).not.toThrow();
  });

  // DEFECT (QA-S4-1): handleCopy chains `.then()` with NO `.catch`, so a rejected writeText
  // (denied clipboard permission — common) becomes an UNHANDLED promise rejection and the
  // user gets no signal at all. A copy that fails must fail visibly-but-gracefully.
  it("handles a rejected clipboard write without an unhandled rejection or silent failure", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    Object.assign(navigator, { clipboard: { writeText } });

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    render(<ExportTabs tokenSet={set} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    // Let the rejected microtask settle and any unhandledRejection macrotask fire.
    await new Promise((r) => setTimeout(r, 60));
    process.off("unhandledRejection", onUnhandled);

    expect(writeText).toHaveBeenCalledOnce();
    // The rejection must be caught — not left to bubble as an unhandled rejection.
    expect(unhandled).toEqual([]);
    // …and the failure should be surfaced, not swallowed (button must not read a plain,
    // unchanged "Copy" as if nothing happened / as if it succeeded).
    expect(
      screen.getByRole("button", { name: /copy failed|couldn.t copy|failed/i }),
    ).toBeInTheDocument();
  });
});

describe("ExportTabs — copy lands the EXACT bytes of the ACTIVE tab", () => {
  it("copies the JSON output (not the default CSS) after switching to the JSON tab", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ExportTabs tokenSet={set} />);

    fireEvent.focus(screen.getByRole("tab", { name: "JSON tokens" }));
    const shown = within(screen.getByRole("tabpanel")).getByText(
      /"\$type": "color"/,
    );
    expect(shown).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const copied = writeText.mock.calls[0][0] as string;

    // The copied bytes must be the JSON panel's, byte-for-byte — not the CSS tab's.
    expect(copied.trimStart().startsWith("{")).toBe(true);
    expect(copied).toContain('"$type": "color"');
    expect(copied).not.toContain("@layer brand");
    // And it must equal exactly what the panel renders (no hidden re-serialization drift).
    expect(copied).toBe(
      within(screen.getByRole("tabpanel")).getByText(/"\$type": "color"/)
        .textContent,
    );
  });
});

describe("ExportTabs — download filename + mime per target", () => {
  const cases = [
    { tab: "CSS variables", filename: "palette.css", mime: "text/css" },
    {
      tab: "Tailwind theme",
      filename: "palette.theme.css",
      mime: "text/css",
    },
    {
      tab: "JSON tokens",
      filename: "palette.tokens.json",
      mime: "application/json",
    },
  ] as const;

  for (const { tab, filename, mime } of cases) {
    it(`downloads ${filename} (${mime}) from the ${tab} tab`, () => {
      const created: { href: string; download: string; blobType: string }[] =
        [];
      const realCreate = document.createElement.bind(document);
      let lastBlobType = "";
      const createObjectURL = vi.fn((blob: Blob) => {
        lastBlobType = blob.type;
        return "blob:mock";
      });
      const revokeObjectURL = vi.fn();
      Object.assign(URL, { createObjectURL, revokeObjectURL });

      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = realCreate(tag) as HTMLElement;
        if (tag === "a") {
          vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(() => {
            created.push({
              href: (el as HTMLAnchorElement).href,
              download: (el as HTMLAnchorElement).download,
              blobType: lastBlobType,
            });
          });
        }
        return el;
      });

      render(<ExportTabs tokenSet={set} />);
      fireEvent.focus(screen.getByRole("tab", { name: tab }));
      fireEvent.click(screen.getByRole("button", { name: "Download" }));

      expect(created).toHaveLength(1);
      expect(created[0].download).toBe(filename);
      expect(created[0].blobType).toBe(mime);
      expect(createObjectURL).toHaveBeenCalledOnce();
      // The object URL must be revoked (no leak).
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    });
  }
});
