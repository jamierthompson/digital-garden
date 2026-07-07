// The export UI (#107) — a tabbed surface across the three targets (CSS variables /
// Tailwind theme / JSON tokens) with a format switch (OKLCH · Hex · RGB) driving the
// engine's `ColorFormat`. Composed from the ui/ primitives: PillTabList (tabs),
// SegmentedControl (format), Button (copy/download). The output is produced ONLY by the
// engine serializers (exporters.ts), so it can never drift from the previewed/derived
// palette.

import { useEffect, useMemo, useRef, useState } from "react";

import { Tabs } from "radix-ui";
import type { ColorFormat, TokenSet } from "@garden/oklch";

import Button from "@/components/ui/Button";
import PillTabList from "@/components/ui/PillTabList";
import SegmentedControl from "@/components/ui/SegmentedControl";

import {
  EXPORT_TABS,
  FORMAT_OPTIONS,
  serializeExport,
  type ExportTabId,
} from "../core/exporters";
import styles from "./ExportTabs.module.css";

interface ExportTabsProps {
  readonly tokenSet: TokenSet;
}

export default function ExportTabs({
  tokenSet,
}: ExportTabsProps): React.ReactElement {
  const [tab, setTab] = useState<ExportTabId>("css");
  const [format, setFormat] = useState<ColorFormat>("oklch");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the pending flash timer on unmount so it never fires against a gone component.
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  // Serialize all three targets for the current format in one memo — produced solely by the
  // engine serializers, so exports and the live palette can't disagree.
  const outputs = useMemo(
    () =>
      Object.fromEntries(
        EXPORT_TABS.map((t) => [t.id, serializeExport(t.id, tokenSet, format)]),
      ) as Record<ExportTabId, string>,
    [tokenSet, format],
  );

  const activeTab = EXPORT_TABS.find((t) => t.id === tab)!;
  const output = outputs[tab];

  // Honesty note for the lossy formats (QA-S4-2): hex/rgb are the sRGB rendering — identical
  // paint for an sRGB palette, but a LOSSY clamp for a P3 one (the engine README's contract).
  // OKLCH is the lossless native form, so no note there.
  const formatNote =
    format === "oklch"
      ? null
      : tokenSet.meta.gamut === "p3"
        ? "Hex & RGB clamp this P3 palette to sRGB — a lossy rendering. OKLCH keeps the full-gamut values."
        : "Hex & RGB are the sRGB rendering of each OKLCH value.";

  const flashCopy = (status: "copied" | "failed"): void => {
    setCopyStatus(status);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopyStatus("idle"), 1500);
  };

  const handleCopy = (): void => {
    // A rejected write (denied permission, unfocused document) must fail visibly, not as an
    // unhandled rejection — so the `.catch` surfaces it on the button (QA-S4-1). The optional
    // chain keeps a missing clipboard API (non-secure context) a graceful no-op.
    void navigator.clipboard
      ?.writeText(output)
      .then(() => flashCopy("copied"))
      .catch(() => flashCopy("failed"));
  };

  const handleDownload = (): void => {
    const blob = new Blob([output], { type: activeTab.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeTab.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Tabs.Root
      className={styles.root}
      value={tab}
      onValueChange={(v) => setTab(v as ExportTabId)}
    >
      <div className={styles.toolbar}>
        <PillTabList label="Export format" tabs={EXPORT_TABS} />

        <div className={styles.actions}>
          <SegmentedControl
            label="Color value format"
            value={format}
            onValueChange={setFormat}
            options={FORMAT_OPTIONS}
          />
          <Button onClick={handleCopy}>
            {copyStatus === "copied"
              ? "Copied"
              : copyStatus === "failed"
                ? "Copy failed"
                : "Copy"}
          </Button>
          <Button onClick={handleDownload}>Download</Button>
        </div>
      </div>

      {formatNote && (
        <p className={styles.formatNote} role="note">
          {formatNote}
        </p>
      )}

      {EXPORT_TABS.map((t) => (
        <Tabs.Content key={t.id} value={t.id} className={styles.content}>
          <pre className={styles.code}>
            <code>{outputs[t.id]}</code>
          </pre>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
