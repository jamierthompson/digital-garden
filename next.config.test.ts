import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";
import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

const PATTERNS = nextConfig.images!.remotePatterns!;

/**
 * The image optimizer's allow-list, exercised through Next's OWN matcher (not a literal
 * config snapshot). Browser QA #322 found the original `new URL("…/**")` shorthand bakes an
 * empty `search` constraint — "no query string allowed" — which 400s every authored-crop
 * image (their URLs carry `?rect=`). The matcher is the behavior that broke, so it is what
 * gets pinned.
 */
describe("images.remotePatterns", () => {
  it("allows a Sanity CDN image URL with an authored-crop query string", () => {
    expect(
      hasRemoteMatch(
        [],
        PATTERNS,
        new URL(
          "https://cdn.sanity.io/images/p/d/abc-1264x848.jpg?rect=0,212,1264,424",
        ),
      ),
    ).toBe(true);
  });

  it("allows a plain (uncropped) Sanity CDN image URL", () => {
    expect(
      hasRemoteMatch(
        [],
        PATTERNS,
        new URL("https://cdn.sanity.io/images/p/d/abc-1264x848.jpg"),
      ),
    ).toBe(true);
  });

  it("blocks non-Sanity hosts and non-image Sanity paths", () => {
    expect(
      hasRemoteMatch([], PATTERNS, new URL("https://evil.example/x.jpg")),
    ).toBe(false);
    expect(
      hasRemoteMatch(
        [],
        PATTERNS,
        new URL("https://cdn.sanity.io/files/p/d/x.mp4"),
      ),
    ).toBe(false);
  });
});
