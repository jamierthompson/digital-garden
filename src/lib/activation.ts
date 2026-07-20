/**
 * Is this click the one that actually navigates in place?
 *
 * A modified click (cmd/ctrl for a new tab, shift for a new window, alt to download) and a
 * non-primary button are handled by the browser, and `next/link` leaves them alone — the current
 * page does not change. Anything reacting to navigation must ignore them, or it fires while the
 * user is still looking at the same page.
 */
export function isPlainActivation(
  event: Pick<
    React.MouseEvent,
    "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "button"
  >,
): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
