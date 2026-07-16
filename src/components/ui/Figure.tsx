import Image from "next/image";
import type { ImageProps } from "next/image";

import Text from "@/components/typography/Text";

import styles from "./Figure.module.css";

interface FigureProps {
  /**
   * The image — a static import (which carries its own dimensions and blur data) or a
   * remote URL from a configured `remotePatterns` origin.
   */
  src: ImageProps["src"];
  alt: string;
  /** Intrinsic dimensions — required for a URL `src` (a static import carries its own). */
  width?: number;
  height?: number;
  /** Optional visible caption → `<figcaption>` (empty/whitespace-only ignored). */
  caption?: string;
  /** The responsive `sizes` attribute — how wide the image renders per viewport. */
  sizes?: string;
  /**
   * Preload the image from `<head>` — set only when the figure is the likely LCP element
   * (above the fold); everything else lazy-loads.
   */
  preload?: boolean;
  /** A tiny data-URL preview (e.g. Sanity's LQIP) — when present, the image blurs up from it. */
  blurDataURL?: string;
}

/**
 * A captioned image — `<figure>` + `next/image` + `<figcaption>`.
 *
 * The generic presentational primitive: it knows nothing about where the image came from
 * (a CMS adapter builds URL/dimensions/blur from its own data; a static page passes an
 * imported asset straight through). Width and height reserve the box before paint, so the
 * image lands with no layout shift; the rendered size is fluid (the CSS scales it to its
 * container), so the props only fix the aspect ratio and cap the largest variant.
 */
export default function Figure({
  src,
  alt,
  width,
  height,
  caption,
  sizes,
  preload,
  blurDataURL,
}: FigureProps) {
  const hasCaption = typeof caption === "string" && caption.trim() !== "";
  return (
    <figure className={styles.figure}>
      <Image
        className={styles.image}
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        preload={preload}
        placeholder={blurDataURL ? "blur" : "empty"}
        blurDataURL={blurDataURL}
      />
      {hasCaption ? (
        <Text variant="caption" color="muted-foreground" asChild>
          <figcaption className={styles.caption}>{caption}</figcaption>
        </Text>
      ) : null}
    </figure>
  );
}
