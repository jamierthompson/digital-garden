import type { Metadata } from "next";

import Page from "@/components/layout/Page";
import Stack from "@/components/layout/Stack";
import PageTheme from "@/components/theme/PageTheme";
import { sitePageThemeSeed } from "@/components/theme/sitePageSeed";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import { space } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "System",
  description:
    "The design system and colophon behind the garden — tokens, the OKLCH color engine, type, and stack. In progress.",
};

/**
 * The shell System page — the site's own design-system / colophon surface (the site
 * documenting itself). Static editorial chrome — reads the global semantic tokens, no
 * theme scope of its own.
 *
 * `async` so it can resolve its authored `pageThemes.system` seed on its own awaited path — a
 * `use cache` read, so the page stays fully prerendered (no dynamic hole) and the theme's `:root`
 * `<style>` hoists into `<head>` ahead of the chrome, flash-free (#187).
 */
export default async function SystemPage() {
  const themeSeed = await sitePageThemeSeed("system");
  return (
    <>
      <PageTheme seed={themeSeed} />
      <Page width="measure">
        <Stack gap={space(4)}>
          <Heading level={1}>System</Heading>
          <Text variant="lead" color="muted-foreground">
            The design system behind the garden — the token tiers, the OKLCH
            color engine, the type system, and the stack, documented in the
            open. This page is being written.
          </Text>
        </Stack>
      </Page>
    </>
  );
}
