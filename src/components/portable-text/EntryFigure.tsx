import Figure from "@/components/ui/Figure";
import { urlFor } from "@/sanity/lib/image";

import type { Body } from "./EntryBody";
import MediaPlaceholder from "./MediaPlaceholder";
import { firstNonEmpty } from "./mediaLabel";

type FigureBlock = Extract<Body[number], { _type: "figure" }>;

/** The generic accessible name when a figure's alt is unusable — a name is never blank. */
const GENERIC_NAME = "Figure";

/**
 * The figure spans the article's `[prose]` column: the full viewport width until the column
 * maxes out at `--width-content` (48rem), fixed there beyond.
 */
const FIGURE_SIZES = "(max-width: 48rem) 100vw, 48rem";

interface NormalizedCrop {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The authored crop as four validated edge fractions, or `null` when absent or malformed
 * (each edge must be a finite number in [0, 1), and each axis must keep a positive
 * remainder). A malformed crop is DROPPED rather than passed through: the builder would
 * bake its NaN/negative math into the URL's `rect=` and the CDN would 400.
 */
function normalizedCrop(crop: FigureBlock["crop"]): NormalizedCrop | null {
  if (!crop) return null;
  const { top = 0, bottom = 0, left = 0, right = 0 } = crop;
  const edges = [top, bottom, left, right];
  if (
    !edges.every((edge) => typeof edge === "number" && edge >= 0 && edge < 1) ||
    top + bottom >= 1 ||
    left + right >= 1
  )
    return null;
  return { top, bottom, left, right };
}

interface ResolvedImage {
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
}

/**
 * Resolve a figure block to everything the image render needs, or `null` for the
 * placeholder fallback.
 *
 * TOTAL over untrusted input — schema validation is bypassable by a raw Content Lake
 * write, so every field is checked before use and the URL builder is fed only sanitized
 * parts (never the raw block). Dimensions are the POST-CROP box: the CDN serves the
 * cropped pixels (the builder bakes the crop into `rect=`), so the reserved ratio must
 * match them or the image would letterbox/shift.
 */
function resolveFigureImage(value: FigureBlock): ResolvedImage | null {
  const asset = value?.asset;
  const dimensions = asset?.metadata?.dimensions;
  if (
    typeof asset?._id !== "string" ||
    asset._id === "" ||
    typeof dimensions?.width !== "number" ||
    typeof dimensions?.height !== "number" ||
    !(dimensions.width > 0) ||
    !(dimensions.height > 0)
  )
    return null;

  const crop = normalizedCrop(value.crop);
  const width = Math.round(
    dimensions.width * (1 - (crop ? crop.left + crop.right : 0)),
  );
  const height = Math.round(
    dimensions.height * (1 - (crop ? crop.top + crop.bottom : 0)),
  );
  if (width < 1 || height < 1) return null;

  let src: string;
  try {
    src = urlFor({
      _type: "image",
      asset: { _id: asset._id },
      ...(crop ? { crop } : {}),
    }).url();
  } catch {
    return null;
  }

  const lqip = asset.metadata?.lqip;
  return {
    src,
    width,
    height,
    blurDataURL: typeof lqip === "string" && lqip !== "" ? lqip : undefined,
  };
}

interface EntryFigureProps {
  value: FigureBlock;
  /** True when the figure is the entry's first body block — the likely LCP element. */
  preload?: boolean;
}

/**
 * The typed `figure` editorial block — the Sanity adapter in front of the generic
 * `ui/Figure` primitive. All the CMS-specific work happens here: the asset id + authored
 * crop become the CDN URL through the shared builder, the asset metadata becomes the
 * reserved box and the blur-up placeholder (LQIP), and a first-block figure preloads as
 * the likely LCP element. Anything the resolve rejects degrades to the shared
 * `MediaPlaceholder` — never a crash, never a broken `<img>`. The accessible name is the
 * alt backstopped by the kind (never blank); the caption shows once, in the
 * `<figcaption>`, not doubled into the name.
 */
export default function EntryFigure({ value, preload }: EntryFigureProps) {
  const image = resolveFigureImage(value);
  if (!image) {
    return (
      <MediaPlaceholder
        labelCandidates={[value?.alt]}
        fallbackLabel={GENERIC_NAME}
        caption={value?.caption}
      />
    );
  }
  return (
    <Figure
      src={image.src}
      alt={firstNonEmpty([value.alt]) ?? GENERIC_NAME}
      width={image.width}
      height={image.height}
      caption={value.caption}
      sizes={FIGURE_SIZES}
      preload={preload}
      blurDataURL={image.blurDataURL}
    />
  );
}
