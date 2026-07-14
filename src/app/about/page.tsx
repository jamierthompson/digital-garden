import type { Metadata } from "next";

import Page from "@/components/layout/Page";
import Stack from "@/components/layout/Stack";
import PageTheme from "@/components/theme/PageTheme";
import { sitePageThemeSeed } from "@/components/theme/sitePageSeed";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import { space } from "@/lib/tokens";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "About",
  description:
    "About this digital garden and the person tending it — how the site is built and what lives here.",
  openGraph: {
    title: "About",
    description:
      "About this digital garden and the person tending it — how the site is built and what lives here.",
    type: "profile",
  },
};

/**
 * The shell About page. Static editorial prose — reads the global semantic tokens
 * (`var(--foreground)`, `var(--font-body)`, …) from `:root`, no theme scope of its own.
 *
 * `async` so it can resolve its authored `pageThemes.about` seed on its own awaited path — a
 * `use cache` read, so the page stays fully prerendered (no dynamic hole) and the theme's `:root`
 * `<style>` hoists into `<head>` ahead of the chrome, flash-free (#187).
 */
export default async function AboutPage() {
  const themeSeed = await sitePageThemeSeed("about");
  return (
    <>
      <PageTheme seed={themeSeed} />
      <Page width="measure">
        <Stack gap={space(6)}>
          <Heading level={1}>About</Heading>
          <Stack gap={space(4)}>
            <Text variant="lede" color="muted-foreground">
              This is a personal portfolio and digital garden — part showcase,
              part notebook. Each project is a self-contained island with its
              own theme color and typeface, composed on one shared foundation.
            </Text>
            <Text variant="lede" color="muted-foreground">
              The colors you see are not hand-picked per element. A single theme
              seed runs through an OKLCH engine that derives an accessible
              palette for both light and dark schemes, then bakes it into the
              page so the theme is present before the first paint — no flash, no
              client-side theming pass.
            </Text>
            <Text variant="lede" color="muted-foreground">
              The garden grows by accretion: projects, working notes, and the
              links between them. Wander through{" "}
              <span className={styles.emphasis}>Work</span>,{" "}
              <span className={styles.emphasis}>Notes</span>, and{" "}
              <span className={styles.emphasis}>Now</span>.
            </Text>
          </Stack>
        </Stack>
      </Page>
    </>
  );
}
