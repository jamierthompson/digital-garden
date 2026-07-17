import { describe, expect, it } from "vitest";

import { BLOCK_LANES, resolveBlockLane } from "./lanes";

describe("resolveBlockLane", () => {
  it("passes each known lane through", () => {
    for (const lane of BLOCK_LANES) {
      expect(resolveBlockLane(lane)).toBe(lane);
    }
  });

  it.each([undefined, null, "", "WIDE", "sidebar", 0, {}, "full;}injection"])(
    "collapses %o to the wide default",
    (value) => {
      expect(resolveBlockLane(value)).toBe("wide");
    },
  );
});
