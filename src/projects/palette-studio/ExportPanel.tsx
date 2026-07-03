// The export UI (#107) — Radix Tabs across the three targets (CSS variables / Tailwind theme /
// JSON tokens) with a format switch (OKLCH · Hex · RGB) driving the engine's `ColorFormat`.
// The output is produced ONLY by the engine serializers (exporters.ts), so it can never drift
// from the previewed/derived palette. Copy-to-clipboard + download per target.

import { useEffect, useMemo, useRef, useState } from "react";

import { RadioGroup, Tabs } from "radix-ui";
import type { ColorFormat, TokenSet } from "@garden/oklch";

import {
  EXPORT_TABS,
  FORMAT_OPTIONS,
  serializeExport,
  type ExportTabId,
} from "./exporters";
import styles from "./ExportPanel.module.css";

interface ExportPanelProps {
  readonly tokenSet: TokenSet;
}

export default function ExportPanel({
  tokenSet,
}: ExportPanelProps): React.ReactElement {
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

  // Flash a transient status on the Copy button, auto-reverting to idle.
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
        <Tabs.List className={styles.tabs} aria-label="Export format">
          {EXPORT_TABS.map((t) => (
            <Tabs.Trigger key={t.id} className={styles.tab} value={t.id}>
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className={styles.actions}>
          <RadioGroup.Root
            className={styles.formats}
            aria-label="Color value format"
            value={format}
            onValueChange={(v) => setFormat(v as ColorFormat)}
            orientation="horizontal"
          >
            {FORMAT_OPTIONS.map((f) => (
              <RadioGroup.Item
                key={f.value}
                className={styles.formatPill}
                value={f.value}
              >
                {f.label}
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>

          <button type="button" className={styles.button} onClick={handleCopy}>
            {copyStatus === "copied"
              ? "Copied"
              : copyStatus === "failed"
                ? "Copy failed"
                : "Copy"}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={handleDownload}
          >
            Download
          </button>
        </div>
      </div>

      {formatNote && (
        <p className={styles.note} role="note">
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
