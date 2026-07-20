import Text from "@/components/typography/Text";
import type { TextColor } from "@/components/typography/textColor";
import { formatDate } from "@/lib/formatDate";

import styles from "./EntryMeta.module.css";

interface EntryMetaProps {
  readonly kind?: string | null;
  readonly stage?: string | null;
  /** The authored last-iterated date (ISO `YYYY-MM-DD`) — rendered as a `<time>` stamp. */
  readonly iterated?: string | null;
  /** The resolved OKLCH seed readout — the value the surface is actually painted with. */
  readonly seed?: string | null;
  /** Backlink hint — rendered only when positive. */
  readonly linkCount?: number | null;
  /** The ink role. Omit to inherit the ambient ink. */
  readonly color?: TextColor;
  readonly className?: string;
}

/**
 * The meta readout every entry surface shares — the ONE way an entry's meta facts
 * render: `kind · stage · iterated <date> · <seed> · N linked`, in that fixed order, each
 * fact only when present (a malformed date is dropped, a non-positive link count is
 * silence, an empty string is absence). Renders nothing at all when no fact survives.
 * Plain meta text by design — no badge/pill treatment. The `·` separators are generated in
 * CSS on EVERY fact and each line's leading dot is clipped away by the track shift (see the
 * module CSS), so a wrapped line can never begin or end with a stranded dot, and the dots
 * never enter accessible names.
 */
/** The runtime contract is WIDER than the props' types — this readout renders live/draft
 *  data, and a raw API write can hand any fact a shape the type forbids. A non-string,
 *  empty, or whitespace-only fact is treated as absent rather than rendered (an object as
 *  a React child throws; an invisible fact still earns a separator dot) — the same
 *  never-throws posture as the theming chain. */
function asText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export default function EntryMeta({
  kind,
  stage,
  iterated,
  seed,
  linkCount,
  color,
  className,
}: EntryMetaProps): React.ReactElement | null {
  const kindText = asText(kind);
  const stageText = asText(stage);
  const iteratedIso = asText(iterated);
  const iteratedLabel = formatDate(iteratedIso);
  const seedText = asText(seed);
  const facts: { key: string; node: React.ReactNode }[] = [];
  if (kindText) facts.push({ key: "kind", node: <span>{kindText}</span> });
  if (stageText) facts.push({ key: "stage", node: <span>{stageText}</span> });
  if (iteratedIso && iteratedLabel) {
    facts.push({
      key: "iterated",
      node: <time dateTime={iteratedIso}>iterated {iteratedLabel}</time>,
    });
  }
  if (seedText) facts.push({ key: "seed", node: <span>{seedText}</span> });
  // Integer-gated, not just positive: GROQ's count() only emits integers, so a fractional
  // or non-finite value is drifted data — silence, never "2.5 linked".
  if (
    typeof linkCount === "number" &&
    Number.isInteger(linkCount) &&
    linkCount > 0
  ) {
    facts.push({ key: "links", node: <span>{linkCount} linked</span> });
  }

  if (facts.length === 0) return null;

  return (
    <Text variant="meta" color={color} asChild>
      <p className={[styles.meta, className].filter(Boolean).join(" ")}>
        <span className={styles.track}>
          {facts.map((fact) => (
            <span key={fact.key} className={styles.fact}>
              {fact.node}
            </span>
          ))}
        </span>
      </p>
    </Text>
  );
}
