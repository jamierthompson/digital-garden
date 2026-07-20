"use client";

import { Menu, X } from "lucide-react";
import { Dialog, VisuallyHidden } from "radix-ui";
import { useRef, useState } from "react";

import Cluster from "@/components/layout/Cluster";
import { isPlainActivation } from "@/lib/activation";
import Stack from "@/components/layout/Stack";

import Logo from "./Logo";
import styles from "./MobileNav.module.css";
import NavLinks from "./NavLinks";
import SchemeToggle from "./SchemeToggle";
import TulipMark from "./TulipMark";

/**
 * The primary nav as a full-height panel, for bands too narrow to carry the links inline.
 *
 * A `Dialog` rather than a `DropdownMenu` because these are navigation LINKS — a dropdown would
 * announce them as `menu`/`menuitem`, a menu of commands. Dialog also brings the focus trap,
 * Escape and scroll lock a full-screen panel needs.
 *
 * The panel draws its own bar rather than letting the header's sit above it on a higher z-index:
 * under a modal dialog everything outside the panel is `aria-hidden` and pointer-blocked, so a
 * toggle left in the header would look operable and not be. The two `SchemeToggle`s can't
 * disagree — both read one external store.
 */
export default function MobileNav(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        ref={triggerRef}
        className={styles.trigger}
        aria-label="Open menu"
      >
        <Menu className={styles.icon} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* Scroll lock lives on `Overlay`, not `Content` — Radix mounts `RemoveScroll` only in
            `DialogOverlayImpl`, so without this the page scrolls behind the open panel. It sits
            below the panel and is never seen. */}
        <Dialog.Overlay className={styles.overlay} />
        {/* `undefined` opts out of Radix's `aria-describedby` wiring; there is no description
            node for it to point at. */}
        <Dialog.Content
          className={styles.panel}
          aria-describedby={undefined}
          onClick={(event) => {
            // Delegated, so EVERY link in the panel closes it — the destinations and the mark
            // alike. Wiring each link individually leaves the next one added navigating away
            // under a panel that is still covering the page. Keyboard activation of a link
            // dispatches a click too, so this covers it. `Logo` stays a Server Component: an
            // event handler cannot be passed to one.
            if (!isPlainActivation(event)) return;
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
          onCloseAutoFocus={(event) => {
            // Radix returns focus to the trigger, and the browser scrolls an off-screen element
            // into view — which throws the reader back to the top of a scrolled page. Restore
            // focus by hand so the scroll position survives dismissal.
            event.preventDefault();
            triggerRef.current?.focus({ preventScroll: true });
          }}
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>Site navigation</Dialog.Title>
          </VisuallyHidden.Root>
          <div className={styles.barRow}>
            <Logo>
              <TulipMark />
            </Logo>
            <Cluster className={styles.controls}>
              <Dialog.Close className={styles.trigger} aria-label="Close menu">
                <X className={styles.icon} aria-hidden="true" />
              </Dialog.Close>
              <SchemeToggle />
            </Cluster>
          </div>
          <nav aria-label="Primary" className={styles.nav}>
            <Stack asChild>
              <NavLinks orientation="stack" />
            </Stack>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
