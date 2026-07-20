import type { TextColor } from "./textColor";
import colorStyles from "./textColor.module.css";

interface InkProps extends React.ComponentPropsWithRef<"span"> {
  /**
   * The semantic ink role — names the `--<role>` color token the run wears (via the shared
   * `textColor` rules, the same contract as the `color` prop on `Heading`/`Text`).
   */
  readonly color: TextColor;
}

/**
 * Inline ink primitive — a `<span>` that wears an ink role and owns nothing else. For a run of
 * text INSIDE a larger type role (an emphasized phrase in a display heading), where `Text` would
 * wrongly re-apply a type bundle: `Ink` colors the run and lets every type property inherit.
 * Color-only emphasis is deliberately invisible to assistive tech — it is a display treatment,
 * not semantic emphasis; reach for a real `<em>` when the meaning changes.
 */
export default function Ink({
  color,
  className,
  ...rest
}: InkProps): React.ReactElement {
  return (
    <span
      className={[colorStyles.ink, className].filter(Boolean).join(" ")}
      {...rest}
      // `data-color` selects the ink; spread `rest` first so the typed prop always wins over a
      // stray literal `data-*` passthrough.
      data-color={color}
    />
  );
}
