import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ClampReceipt from "./ClampReceipt";

describe("ClampReceipt", () => {
  it("renders nothing when the color already fits sRGB", () => {
    const { container } = render(<ClampReceipt clamp={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("reports the trimmed chroma, text-backed, when the color exceeds sRGB", () => {
    render(<ClampReceipt clamp={{ deltaC: 0.043 }} />);
    const note = screen.getByRole("note");
    // Text-backed (not color-only): the meaning is in the words.
    expect(note).toHaveTextContent(/more vivid than an srgb screen can show/i);
    // The trimmed amount, to 2 dp.
    expect(note).toHaveTextContent("trimmed by 0.04");
  });
});
