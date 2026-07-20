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
 * The primary nav as a full-height panel, for viewports too narrow to carry the links inline
 * (`SiteNav` decides which presentation shows). A Radix `Dialog` rather than a `DropdownMenu`:
 * these are navigation LINKS, and a dropdown would announce them as `menu`/`menuitem` — a menu
 * of commands, which they are not. Dialog also brings the focus trap, Escape-to-close and scroll
 * lock a full-screen panel needs.
 *
 * The panel renders its OWN bar — logo, close, scheme toggle — rather than letting the header's
 * bar sit above it on a higher z-index. Under a modal dialog everything outside the panel is
 * `aria-hidden` and pointer-blocked, so a floated-above toggle would LOOK operable and not be.
 * Duplicating the bar keeps the toggle genuinely usable while open, and because it is laid out on
 * the same grid lane with the same block padding, opening the panel changes the glyph and nothing
 * else. The two `SchemeToggle`s can't disagree — both read one external store.
 */
export default function MobileNav(): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={styles.trigger} aria-label="Open menu">
        <Menu className={styles.icon} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* No `Description`, so the dialog is named by its title alone — `undefined` opts out of
            Radix's `aria-describedby` wiring rather than pointing it at a node that isn't there. */}
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
