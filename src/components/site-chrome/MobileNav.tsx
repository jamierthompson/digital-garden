"use client";

import { Menu, X } from "lucide-react";
import { Dialog, VisuallyHidden } from "radix-ui";
import { useState } from "react";

import Cluster from "@/components/layout/Cluster";
import Stack from "@/components/layout/Stack";

import Logo, { PlaceholderMark } from "./Logo";
import styles from "./MobileNav.module.css";
import NavLinks from "./NavLinks";
import SchemeToggle from "./SchemeToggle";

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

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={styles.trigger} aria-label="Open menu">
        <Menu className={styles.icon} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* `undefined` opts out of Radix's `aria-describedby` wiring; there is no description
            node for it to point at. */}
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          <VisuallyHidden.Root asChild>
            <Dialog.Title>Site navigation</Dialog.Title>
          </VisuallyHidden.Root>
          <div className={styles.barRow}>
            <Logo>
              <PlaceholderMark />
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
              <NavLinks orientation="stack" onNavigate={() => setOpen(false)} />
            </Stack>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
