import Text from "@/components/typography/Text";

import styles from "./EntryVideo.module.css";
import MediaPlaceholder from "./MediaPlaceholder";
import { isNonBlank } from "./mediaLabel";

interface VideoValue {
  url?: string;
  caption?: string;
}

/** The generic accessible name when a video is uncaptioned — a `role`/`title` is never blank. */
const GENERIC_NAME = "Video";

/**
 * Hosts whose URLs may be turned into an `<iframe>` embed. An iframe runs the provider's page
 * (scripts, its own origin), so this is the real trust boundary — kept to the canonical provider
 * hosts and matched by exact `hostname` equality (never `endsWith`/`includes`, which a lookalike
 * like `youtube.com.evil.com` or `evilyoutube.com` would slip through). `new URL` lowercases the
 * hostname, so the set is lowercase.
 */
const YOUTUBE_HOSTS: ReadonlySet<string> = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);
const VIMEO_HOSTS: ReadonlySet<string> = new Set([
  "vimeo.com",
  "www.vimeo.com",
  "player.vimeo.com",
]);

/** A YouTube video id is exactly 11 URL-safe base64 chars; a Vimeo id is digits. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d+$/;

/**
 * Hosts a native `<video>` file source may be fetched from — pinned, exactly like the iframe host
 * sets. A `<video src>` fetches from the reader's browser on render, so an arbitrary host would be
 * a client-side IP/referrer leak; images already resolve through Sanity's CDN, so file media is
 * held to the same origin rather than becoming the product's first arbitrary-host fetch. Widen this
 * set deliberately if another trusted media origin is ever added.
 */
const VIDEO_FILE_HOSTS: ReadonlySet<string> = new Set(["cdn.sanity.io"]);

/**
 * File extensions rendered as a native `<video>`. The native-file path is a positive allow-list on
 * BOTH host and extension: only a recognized media extension on an allow-listed host becomes a
 * source, so an unclassifiable or off-origin URL degrades to the placeholder rather than a broken
 * or arbitrary-host `<video>`.
 */
const VIDEO_FILE_EXTENSIONS: readonly string[] = [
  ".mp4",
  ".webm",
  ".ogg",
  ".ogv",
  ".mov",
  ".m4v",
];

type VideoEmbed =
  | { readonly kind: "iframe"; readonly src: string }
  | { readonly kind: "file"; readonly src: string };

/** The first non-empty path segment of a URL (`/embed/ID/` → `embed`), or `undefined`. */
function firstSegment(pathname: string): string | undefined {
  return pathname.split("/").filter(Boolean)[0];
}

/** The YouTube video id from a watch / short / embed / youtu.be URL, if one is present. */
function youtubeId(parsed: URL): string | undefined {
  if (parsed.hostname === "youtu.be") return firstSegment(parsed.pathname);
  if (parsed.pathname === "/watch")
    return parsed.searchParams.get("v") ?? undefined;
  const [prefix, id] = parsed.pathname.split("/").filter(Boolean);
  if (prefix === "embed" || prefix === "shorts" || prefix === "live") return id;
  return undefined;
}

/** The Vimeo video id from a `vimeo.com/ID` or `player.vimeo.com/video/ID` URL, if present. */
function vimeoId(parsed: URL): string | undefined {
  if (parsed.hostname === "player.vimeo.com") {
    const [prefix, id] = parsed.pathname.split("/").filter(Boolean);
    return prefix === "video" ? id : undefined;
  }
  return firstSegment(parsed.pathname);
}

/**
 * Resolve an untrusted `url` to a safe embed, or `null` for the placeholder fallback.
 *
 * SECURITY-CRITICAL and total: the input is untrusted (`unknown`) because schema validation is
 * bypassable by a raw Content Lake write, so the URL is *parsed* (`new URL`, never string
 * matching) and every check is positive — it must affirmatively classify as a provider embed or a
 * recognized media file, or it falls back. Nothing that fails a check ever reaches a `src`, and
 * the function never throws. The scheme is pinned to `https:` (killing `javascript:`, `data:`,
 * `http:`, and — via `new URL` throwing on a base-less protocol-relative `//host` — that class
 * too); iframe hosts are exact-matched against the allow-list; the embed URL is rebuilt from a
 * format-validated id, so no attacker-controlled string is interpolated into it; and the native
 * `<video>` file path is exact-matched against its own pinned host set too, so it can't become an
 * arbitrary-host fetch from the reader's browser. Both paths REBUILD their `src` from validated
 * parts rather than echoing the input — the file path from the pinned hostname + parsed
 * pathname/query, which drops userinfo and any port.
 */
export function resolveVideoEmbed(url: unknown): VideoEmbed | null {
  if (typeof url !== "string") return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;

  if (YOUTUBE_HOSTS.has(parsed.hostname)) {
    const id = youtubeId(parsed);
    if (id && YOUTUBE_ID.test(id))
      return { kind: "iframe", src: `https://www.youtube.com/embed/${id}` };
    return null;
  }

  if (VIMEO_HOSTS.has(parsed.hostname)) {
    const id = vimeoId(parsed);
    if (id && VIMEO_ID.test(id))
      return { kind: "iframe", src: `https://player.vimeo.com/video/${id}` };
    return null;
  }

  const path = parsed.pathname.toLowerCase();
  if (
    VIDEO_FILE_HOSTS.has(parsed.hostname) &&
    VIDEO_FILE_EXTENSIONS.some((ext) => path.endsWith(ext))
  )
    return {
      kind: "file",
      src: `https://${parsed.hostname}${parsed.pathname}${parsed.search}`,
    };

  return null;
}

/**
 * The typed `video` editorial block — a referenced video (URL + optional caption).
 *
 * The URL is resolved through the security-critical allow-list first (`resolveVideoEmbed`): a
 * provider URL becomes a native-height iframe, a hosted media file a native `<video controls>`,
 * and anything that fails the checks the shared `MediaPlaceholder` — so a hostile or malformed URL
 * degrades to the labelled placeholder rather than reaching a `src`. Every path renders inside a
 * 16:9 box (the placeholder reserves it identically), so the embed lands with no layout shift. The
 * accessible name comes from the caption (the iframe `title` / video `aria-label`), falling back
 * to the generic kind when uncaptioned; the caption also shows in the `<figcaption>` beneath.
 */
export default function EntryVideo({ value }: { value: VideoValue }) {
  const embed = resolveVideoEmbed(value.url);
  if (!embed) {
    return (
      <MediaPlaceholder
        labelCandidates={[]}
        fallbackLabel={GENERIC_NAME}
        caption={value.caption}
        ratio="16 / 9"
      />
    );
  }

  const accessibleName = isNonBlank(value.caption)
    ? value.caption
    : GENERIC_NAME;

  return (
    <figure className={styles.figure}>
      <div className={styles.frame}>
        {embed.kind === "iframe" ? (
          <iframe
            className={styles.embed}
            src={embed.src}
            title={accessibleName}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
          />
        ) : (
          <video
            className={styles.embed}
            src={embed.src}
            aria-label={accessibleName}
            controls
            preload="metadata"
            playsInline
          />
        )}
      </div>
      {isNonBlank(value.caption) ? (
        <Text variant="caption" color="muted-foreground" asChild>
          <figcaption className={styles.caption}>{value.caption}</figcaption>
        </Text>
      ) : null}
    </figure>
  );
}
