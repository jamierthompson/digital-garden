/**
 * TS mirror of `--width-content` (dimension.css) — for the rare place markup needs the
 * value BEFORE CSS applies: an img `sizes` attribute is read by the browser's preload
 * scanner pre-layout, so it cannot reference a custom property. The mirror is
 * drift-guarded: `dimension.test.ts` parses the CSS token and fails the moment the two
 * disagree, so a design pass that retunes the token breaks a test, not the srcset math.
 */
export const WIDTH_CONTENT = "42rem";
