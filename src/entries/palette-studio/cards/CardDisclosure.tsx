"use client";

// Progressive disclosure for a swatch card (#154) — the "why this step?" affordance that
// opens the rich preview (full ramp context, targets, the gamut story) a card can't hold.
//
// Built on Radix Popover as the accessible BASELINE: the trigger is a real button, so
// click, touch, and keyboard (Enter/Space) all open it; Escape and outside-click dismiss it;
// it stays open until dismissed — satisfying WCAG 1.4.13 (dismissible, persistent) for every
// input modality. Mouse HOVER is layered on as a pure enhancement, gated to
// `pointerType === "mouse"` so it never fights the click toggle on touch, with a close-grace
// timer so the pointer can travel onto the (hoverable, 1.4.13) content. A hover-opened
// popover does NOT steal focus; a keyboard-opened one does, so its content is reachable.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Popover } from "radix-ui";

import styles from "./CardDisclosure.module.css";

interface CardDisclosureProps {
  /** The trigger's visible text — e.g. "Why this step?". */
  readonly label: string;
  /** The preview's heading. */
  readonly title: string;
  /** The rich preview body. */
  readonly children: ReactNode;
}

/** Grace period so a mouse can leave the trigger and reach the content without it closing. */
const HOVER_CLOSE_GRACE_MS = 140;

export default function CardDisclosure({
  label,
  title,
  children,
}: CardDisclosureProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True only while the current open was initiated by hover — used to suppress focus theft.
  const hoverOpenedRef = useRef(false);

  const cancelClose = useCallback((): void => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  // Clear any pending timer on unmount so a fired timeout never touches an unmounted state.
  useEffect(() => cancelClose, [cancelClose]);

  const handleOpenChange = useCallback((next: boolean): void => {
    // Click / keyboard / Escape / outside-click all flow through here (Radix-driven), so a
    // keyboard-opened popover keeps `hoverOpened` false and is allowed to take focus.
    if (!next) hoverOpenedRef.current = false;
    setOpen(next);
  }, []);

  const openByHover = useCallback(
    (event: React.PointerEvent): void => {
      if (event.pointerType !== "mouse") return; // touch/pen: let the click toggle own it
      cancelClose();
      hoverOpenedRef.current = true;
      setOpen(true);
    },
    [cancelClose],
  );

  const scheduleClose = useCallback(
    (event: React.PointerEvent): void => {
      if (event.pointerType !== "mouse") return;
      cancelClose();
      closeTimer.current = setTimeout(() => {
        hoverOpenedRef.current = false;
        setOpen(false);
      }, HOVER_CLOSE_GRACE_MS);
    },
    [cancelClose],
  );

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        type="button"
        className={styles.trigger}
        onPointerEnter={openByHover}
        onPointerLeave={scheduleClose}
      >
        <span aria-hidden="true" className={styles.triggerGlyph}>
          ?
        </span>
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.content}
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
          onOpenAutoFocus={(event) => {
            if (hoverOpenedRef.current) event.preventDefault();
          }}
        >
          <p className={styles.title}>{title}</p>
          {children}
          <Popover.Arrow className={styles.arrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
