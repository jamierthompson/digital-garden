import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getClient` is the security boundary `sanityFetch` leans on, so the load-bearing
 * behaviour is the DRAFT branch: it must attach the per-request token to the
 * drafts-capable client, and — critically — must **throw loudly** when Draft Mode is
 * on but the server-only token is missing, rather than silently handing back the
 * published client (which would leak stale published content into Preview with no
 * signal). [security-and-ops §3, D16]
 *
 * `./client` is mocked to sentinel objects so no real `createClient`/`env.ts` runs —
 * we're testing the selector's branching, not the clients themselves (that's
 * client.test.ts).
 */
const { publicClient, draftClient, configuredDraftClient, withConfigSpy } =
  vi.hoisted(() => {
    const configuredDraftClient = { __id: "draft+token" };
    const withConfigSpy = vi.fn(() => configuredDraftClient);
    return {
      publicClient: { __id: "public" },
      draftClient: { __id: "draft", withConfig: withConfigSpy },
      configuredDraftClient,
      withConfigSpy,
    };
  });

vi.mock("./client", () => ({ client: publicClient, draftClient }));

import { getClient } from "./getClient";

const TOKEN_VAR = "SANITY_API_READ_TOKEN";
let savedToken: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedToken = process.env[TOKEN_VAR];
});

afterEach(() => {
  if (savedToken === undefined) {
    delete process.env[TOKEN_VAR];
  } else {
    process.env[TOKEN_VAR] = savedToken;
  }
});

describe("getClient", () => {
  it("returns the published public client when Draft Mode is off", () => {
    process.env[TOKEN_VAR] = "secret-token"; // present, but must be ignored when off
    expect(getClient(false)).toBe(publicClient);
    expect(withConfigSpy).not.toHaveBeenCalled();
  });

  it("attaches the per-request token to the draft client when Draft Mode is on", () => {
    process.env[TOKEN_VAR] = "secret-token";
    expect(getClient(true)).toBe(configuredDraftClient);
    expect(withConfigSpy).toHaveBeenCalledWith({ token: "secret-token" });
  });

  it("throws loudly (never falls back to published) when the token is missing under Draft Mode", () => {
    delete process.env[TOKEN_VAR];
    expect(() => getClient(true)).toThrowError(
      /SANITY_API_READ_TOKEN is not set/,
    );
    // The fail is the whole point: it must NOT silently hand back the public client.
    expect(withConfigSpy).not.toHaveBeenCalled();
  });
});
