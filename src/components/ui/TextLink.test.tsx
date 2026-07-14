import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import TextLink, { type TextLinkVariant } from "./TextLink";
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

  describe("adversarial QA", () => {
    it("forwards a ref to the rendered anchor", () => {
      const ref = { current: null as HTMLAnchorElement | null };
      render(
        <TextLink variant="accent" href="/x" ref={ref}>
          go
        </TextLink>,
      );
      expect(ref.current).toBe(screen.getByRole("link", { name: "go" }));
    });

    it("forwards a ref through asChild to the underlying anchor (composed refs)", () => {
      const ref = { current: null as HTMLAnchorElement | null };
      render(
        <TextLink variant="quiet" asChild ref={ref}>
          <Link href="/entry">Entry title</Link>
        </TextLink>,
      );
      expect(ref.current).toBe(
        screen.getByRole("link", { name: "Entry title" }),
      );
    });

    it("keeps all three class sources under asChild: base link class, own className, child's className", () => {
      render(
        <TextLink variant="muted" asChild className="from-textlink">
          <Link href="/x" className="from-child">
            go
          </Link>
        </TextLink>,
      );
      const link = screen.getByRole("link", { name: "go" });
      expect(link).toHaveClass(styles.link);
      expect(link).toHaveClass("from-textlink");
      expect(link).toHaveClass("from-child");
    });

    it("composes click handlers under asChild — both TextLink's and the child's fire", () => {
      const onTextLinkClick = vi.fn();
      const onChildClick = vi.fn();
      render(
        <TextLink variant="quiet" asChild onClick={onTextLinkClick}>
          <Link
            href="/x"
            onClick={(event) => {
              event.preventDefault();
              onChildClick(event);
            }}
          >
            go
          </Link>
        </TextLink>,
      );
      fireEvent.click(screen.getByRole("link", { name: "go" }));
      expect(onChildClick).toHaveBeenCalledTimes(1);
      expect(onTextLinkClick).toHaveBeenCalledTimes(1);
    });

    it("fails safe on a runtime-unknown variant: still a working link, unmatched ink bundle only", () => {
      // The type system forbids this; simulate untyped data reaching the prop at runtime.
      const bogus = "wat" as unknown as TextLinkVariant;
      render(
        <TextLink variant={bogus} href="/x">
          go
        </TextLink>,
      );
      const link = screen.getByRole("link", { name: "go" });
      expect(link).toHaveAttribute("href", "/x");
      expect(link).toHaveClass(styles.link);
      expect(link).toHaveAttribute("data-variant", "wat");
    });
  });

  it("lets the typed variant win over a stray data-variant passthrough", () => {
    render(
      // A literal `data-variant` is type-legal (data-* props are accepted), so the
      // component's `{...rest}`-before-`data-variant` spread order is what keeps the
      // typed prop authoritative — this guards that reachable consumer mistake.
      <TextLink variant="accent" href="/x" data-variant="quiet">
        go
      </TextLink>,
    );
    expect(screen.getByRole("link", { name: "go" })).toHaveAttribute(
      "data-variant",
      "accent",
    );
  });

  // jsdom applies no CSS, so the ink-role bindings that make the variants correct are pinned
  // at the source (same pragmatic approach as SiteFooter/NavLinks). The real painted contrast
  // is a browser QA pass.
  describe("variant ink roles (module source)", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/components/ui/TextLink.module.css"),
      "utf8",
    );

    it("uses text-grade --accent-text for quiet's hover so it stays size-safe (not UI-grade --accent)", () => {
      const rule =
        css.match(/\[data-variant="quiet"\]:hover\s*\{([^}]*)\}/)?.[1] ?? "";
      expect(rule).toMatch(/color:\s*var\(--accent-text\)/);
      expect(rule).not.toMatch(/color:\s*var\(--accent\)/);
    });

    it("lights the current page (aria-current) with the same foreground ink as muted's hover", () => {
      expect(css).toMatch(
        /\[data-variant="muted"\]\[aria-current="page"\][\s\S]*?color:\s*var\(--foreground\)/,
      );
    });
  });
});
