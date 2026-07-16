import {
  createImageUrlBuilder,
  type ImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";

import { dataset, projectId } from "./env";

const builder = createImageUrlBuilder({ projectId, dataset });

/**
 * The one Sanity image-URL builder — every image URL the app renders resolves through here.
 *
 * With no output size requested, the builder still bakes the editor's authored crop into the
 * URL (`rect=`), so the CDN serves the cropped pixels; resizing is left to Next's image
 * optimizer, which generates the responsive variants from that single canonical URL.
 */
export function urlFor(source: SanityImageSource): ImageUrlBuilder {
  return builder.image(source);
}
