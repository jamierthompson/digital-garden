import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryVideo, { resolveVideoEmbed } from "./EntryVideo";

type VideoValue = Parameters<typeof EntryVideo>[0]["value"];

const YT_ID = "dQw4w9WgXcQ";

describe("EntryVideo", () => {
  // The security core: an untrusted URL is parsed and positively classified before any attribute
  // rendering. Schema validation is bypassable by a raw Content Lake write, so these cases attack
  // the resolver directly — every rejected input must return null (→ placeholder), never a src.
  describe("resolveVideoEmbed — URL safety allow-list", () => {
    it("rejects a non-string url (drifted shape / absent)", () => {
      expect(resolveVideoEmbed(undefined)).toBeNull();
      expect(resolveVideoEmbed(null)).toBeNull();
      expect(resolveVideoEmbed(42)).toBeNull();
      expect(resolveVideoEmbed({})).toBeNull();
    });

    it("rejects a non-https scheme", () => {
      expect(resolveVideoEmbed("javascript:alert(1)")).toBeNull();
      expect(
        resolveVideoEmbed("data:text/html,<script>alert(1)</script>"),
      ).toBeNull();
      expect(resolveVideoEmbed("http://example.com/clip.mp4")).toBeNull();
      expect(
        resolveVideoEmbed("http://www.youtube.com/watch?v=" + YT_ID),
      ).toBeNull();
      // vbscript and file schemes are equally non-https.
      expect(resolveVideoEmbed("vbscript:msgbox(1)")).toBeNull();
    });

    it("rejects a protocol-relative or malformed url (new URL throws)", () => {
      expect(resolveVideoEmbed("//evil.com/clip.mp4")).toBeNull();
      expect(resolveVideoEmbed("")).toBeNull();
      expect(resolveVideoEmbed("not a url")).toBeNull();
    });

    it("rejects a lookalike host for the iframe path (exact-match only)", () => {
      // Suffix and prefix lookalikes must not be treated as the provider.
      expect(
        resolveVideoEmbed(`https://youtube.com.evil.com/watch?v=${YT_ID}`),
      ).toBeNull();
      expect(
        resolveVideoEmbed(`https://evilyoutube.com/watch?v=${YT_ID}`),
      ).toBeNull();
      expect(
        resolveVideoEmbed("https://vimeo.com.evil.com/123456789"),
      ).toBeNull();
      expect(
        resolveVideoEmbed("https://player.vimeo.evil.com/video/123456789"),
      ).toBeNull();
    });

    it("rejects a provider host with an unusable id", () => {
      // Too short / wrong-shaped YouTube id.
      expect(
        resolveVideoEmbed("https://www.youtube.com/watch?v=short"),
      ).toBeNull();
      expect(resolveVideoEmbed("https://www.youtube.com/watch")).toBeNull();
      expect(resolveVideoEmbed("https://youtu.be/")).toBeNull();
      // Non-numeric Vimeo id.
      expect(resolveVideoEmbed("https://vimeo.com/not-a-number")).toBeNull();
      expect(resolveVideoEmbed("https://vimeo.com/")).toBeNull();
    });

    it("rejects an https url that is neither a provider nor a recognized media file", () => {
      expect(resolveVideoEmbed("https://example.com/page")).toBeNull();
      expect(resolveVideoEmbed("https://example.com/video")).toBeNull();
    });

    it("resolves a YouTube watch / short / embed / youtu.be url to the canonical embed", () => {
      const embed = {
        kind: "iframe",
        src: `https://www.youtube.com/embed/${YT_ID}`,
      };
      expect(
        resolveVideoEmbed(`https://www.youtube.com/watch?v=${YT_ID}`),
      ).toEqual(embed);
      expect(resolveVideoEmbed(`https://youtube.com/watch?v=${YT_ID}`)).toEqual(
        embed,
      );
      expect(
        resolveVideoEmbed(`https://m.youtube.com/watch?v=${YT_ID}`),
      ).toEqual(embed);
      expect(resolveVideoEmbed(`https://youtu.be/${YT_ID}`)).toEqual(embed);
      expect(
        resolveVideoEmbed(`https://www.youtube.com/embed/${YT_ID}`),
      ).toEqual(embed);
      expect(
        resolveVideoEmbed(`https://www.youtube.com/shorts/${YT_ID}`),
      ).toEqual(embed);
      // Extra query params don't defeat the id extraction.
      expect(
        resolveVideoEmbed(`https://www.youtube.com/watch?v=${YT_ID}&t=30s`),
      ).toEqual(embed);
      expect(resolveVideoEmbed(`https://youtu.be/${YT_ID}?t=30`)).toEqual(
        embed,
      );
    });

    it("resolves a Vimeo url to the player embed", () => {
      const embed = {
        kind: "iframe",
        src: "https://player.vimeo.com/video/123456789",
      };
      expect(resolveVideoEmbed("https://vimeo.com/123456789")).toEqual(embed);
      expect(resolveVideoEmbed("https://www.vimeo.com/123456789")).toEqual(
        embed,
      );
      expect(
        resolveVideoEmbed("https://player.vimeo.com/video/123456789"),
      ).toEqual(embed);
    });

    it("resolves an allow-listed-host media file to a native-video source (case-insensitive extension)", () => {
      expect(
        resolveVideoEmbed("https://cdn.sanity.io/files/p/d/v.mp4"),
      ).toEqual({
        kind: "file",
        src: "https://cdn.sanity.io/files/p/d/v.mp4",
      });
      expect(
        resolveVideoEmbed("https://cdn.sanity.io/files/p/d/clip.webm"),
      ).toEqual({
        kind: "file",
        src: "https://cdn.sanity.io/files/p/d/clip.webm",
      });
      expect(
        resolveVideoEmbed("https://cdn.sanity.io/files/p/d/V.MP4"),
      ).toEqual({
        kind: "file",
        src: "https://cdn.sanity.io/files/p/d/V.MP4",
      });
    });

    // The native-file path is pinned to a host set, not just an extension: a media file on any
    // other host would be the product's first arbitrary-host fetch from a reader's browser (an
    // IP/referrer leak), so it must fall back to the placeholder — even with a valid extension.
    it("rejects a media file on a non-allow-listed host", () => {
      expect(resolveVideoEmbed("https://example.com/v.mp4")).toBeNull();
      expect(resolveVideoEmbed("https://cdn.example.com/clip.webm")).toBeNull();
      // A lookalike of the allow-listed host is not the allow-listed host (exact match).
      expect(
        resolveVideoEmbed("https://cdn.sanity.io.evil.com/v.mp4"),
      ).toBeNull();
      expect(resolveVideoEmbed("https://evilcdn.sanity.io/v.mp4")).toBeNull();
    });
  });

  describe("real embed rendering", () => {
    it("renders a YouTube url as an iframe titled by the caption", () => {
      const { container } = render(
        <EntryVideo
          value={{
            url: `https://www.youtube.com/watch?v=${YT_ID}`,
            caption: "My talk",
          }}
        />,
      );
      const iframe = container.querySelector("iframe");
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute("src")).toBe(
        `https://www.youtube.com/embed/${YT_ID}`,
      );
      // Caption → accessible name (iframe title), and the same caption shows in the figcaption.
      expect(iframe?.getAttribute("title")).toBe("My talk");
      expect(container.querySelector("figcaption")).toHaveTextContent(
        "My talk",
      );
    });

    it("renders a Vimeo url as an iframe with the generic name when uncaptioned", () => {
      const { container } = render(
        <EntryVideo value={{ url: "https://vimeo.com/123456789" }} />,
      );
      const iframe = container.querySelector("iframe");
      expect(iframe?.getAttribute("src")).toBe(
        "https://player.vimeo.com/video/123456789",
      );
      expect(iframe?.getAttribute("title")).toBe("Video");
      expect(container.querySelector("figcaption")).toBeNull();
    });

    it("renders a direct file as a native <video controls> named by the caption", () => {
      const { container } = render(
        <EntryVideo
          value={{
            url: "https://cdn.sanity.io/files/p/d/v.mp4",
            caption: "A demo reel",
          }}
        />,
      );
      const video = container.querySelector("video");
      expect(video).not.toBeNull();
      expect(video?.getAttribute("src")).toBe(
        "https://cdn.sanity.io/files/p/d/v.mp4",
      );
      expect(video?.hasAttribute("controls")).toBe(true);
      expect(video?.getAttribute("aria-label")).toBe("A demo reel");
      expect(container.querySelector("figcaption")).toHaveTextContent(
        "A demo reel",
      );
    });

    it("names an uncaptioned native video generically and omits the figcaption", () => {
      const { container } = render(
        <EntryVideo value={{ url: "https://cdn.sanity.io/files/p/d/v.mp4" }} />,
      );
      const video = container.querySelector("video");
      expect(video?.getAttribute("aria-label")).toBe("Video");
      expect(container.querySelector("figcaption")).toBeNull();
    });

    it("treats a whitespace-only caption as absent (generic name, no figcaption)", () => {
      const { container } = render(
        <EntryVideo
          value={{
            url: "https://cdn.sanity.io/files/p/d/v.mp4",
            caption: "   ",
          }}
        />,
      );
      const video = container.querySelector("video");
      expect(video?.getAttribute("aria-label")).toBe("Video");
      expect(container.querySelector("figcaption")).toBeNull();
    });

    // Shape drift: a raw write can put any JSON where the caption string should be. A non-string
    // caption must degrade to the generic name, never reach `.trim()` and crash the article.
    it("survives a caption drifted to a non-string shape", () => {
      const drifted = {
        url: "https://cdn.sanity.io/files/p/d/v.mp4",
        caption: 42,
      } as unknown as VideoValue;
      const { container } = render(<EntryVideo value={drifted} />);
      expect(container.querySelector("video")?.getAttribute("aria-label")).toBe(
        "Video",
      );
      expect(container.querySelector("figcaption")).toBeNull();
    });
  });

  describe("placeholder fallback", () => {
    // Total at the seam: a `video` block whose required URL was dropped by a raw API write must
    // still render (the placeholder), never crash the article — and hold the 16:9 box so a later
    // valid URL would land without layout shift.
    it("renders the placeholder in a 16:9 box when the url is absent", () => {
      render(<EntryVideo value={{}} />);
      const box = screen.getByRole("img", { name: "Video" });
      expect(box.style.getPropertyValue("--placeholder-ratio")).toBe("16 / 9");
    });

    // The security guarantee at the render boundary: a hostile URL never reaches a navigable or
    // loadable attribute — it renders the placeholder, and the URL text never appears in the DOM.
    it("never renders a hostile url into a navigable/loadable attribute", () => {
      const hostile = "javascript:alert(1)";
      const { container } = render(<EntryVideo value={{ url: hostile }} />);
      expect(screen.getByRole("img", { name: "Video" })).toBeInTheDocument();
      expect(
        container.querySelector("iframe, video, a, [href], [src]"),
      ).toBeNull();
      expect(container.innerHTML).not.toContain(hostile);
    });

    it("renders the placeholder (not an iframe) for a provider-lookalike host", () => {
      const { container } = render(
        <EntryVideo
          value={{ url: `https://youtube.com.evil.com/watch?v=${YT_ID}` }}
        />,
      );
      expect(container.querySelector("iframe")).toBeNull();
      expect(screen.getByRole("img", { name: "Video" })).toBeInTheDocument();
    });

    it("renders the placeholder for an unclassifiable https url, keeping the caption", () => {
      const { container } = render(
        <EntryVideo
          value={{ url: "https://example.com/page", caption: "A reel" }}
        />,
      );
      expect(container.querySelector("iframe, video")).toBeNull();
      expect(screen.getByRole("img", { name: "Video" })).toBeInTheDocument();
      expect(container.querySelector("figcaption")).toHaveTextContent("A reel");
    });

    // A valid media extension on an off-origin host is NOT rendered as a native <video> — the file
    // path is host-pinned, so it degrades to the placeholder rather than fetching from that host.
    it("renders the placeholder (not a video) for a media file on a non-allow-listed host", () => {
      const { container } = render(
        <EntryVideo value={{ url: "https://example.com/v.mp4" }} />,
      );
      expect(container.querySelector("video")).toBeNull();
      expect(screen.getByRole("img", { name: "Video" })).toBeInTheDocument();
    });
  });
});
