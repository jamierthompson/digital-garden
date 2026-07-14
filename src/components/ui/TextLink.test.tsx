import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";

import TextLink from "./TextLink";
import styles from "./TextLink.module.css";

describe("TextLink", () => {
  it("renders a bare <a> that passes href + rel through (external-link default)", () => {
    render(
      <TextLink
        variant="accent"
        href="https://nownownow.com/about"
        rel="noopener noreferrer"
      >
        now page
      </TextLink>,
    );
    const link = screen.getByRole("link", { name: "now page" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://nownownow.com/about");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each(["quiet", "accent", "muted"] as const)(
    "stamps data-variant=%s so the module selects that ink bundle",
    (variant) => {
      render(
        <TextLink variant={variant} href="/x">
          go
        </TextLink>,
      );
      expect(screen.getByRole("link", { name: "go" })).toHaveAttribute(
        "data-variant",
        variant,
      );
    },
  );

  it("wears the base link class alongside a passed className", () => {
    render(
      <TextLink variant="muted" href="/x" className="extra">
        go
      </TextLink>,
    );
    const link = screen.getByRole("link", { name: "go" });
    expect(link).toHaveClass(styles.link);
    expect(link).toHaveClass("extra");
  });

  it("merges the treatment onto a child link via asChild (no extra wrapper anchor)", () => {
    render(
      <TextLink variant="quiet" asChild>
        <Link href="/entry">Entry title</Link>
      </TextLink>,
    );
    const links = screen.getAllByRole("link");
    // Slot merges onto the single child — exactly one anchor, carrying the class + variant.
    expect(links).toHaveLength(1);
    const link = links[0];
    expect(link).toHaveAttribute("href", "/entry");
    expect(link).toHaveClass(styles.link);
    expect(link).toHaveAttribute("data-variant", "quiet");
  });

  it("lets the typed variant win over a stray data-variant passthrough", () => {
    render(
      <TextLink
        variant="accent"
        href="/x"
        // @ts-expect-error — a literal data-variant must not override the typed prop.
        data-variant="quiet"
      >
        go
      </TextLink>,
    );
    expect(screen.getByRole("link", { name: "go" })).toHaveAttribute(
      "data-variant",
      "accent",
    );
  });
});
