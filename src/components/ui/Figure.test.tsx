import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Figure from "./Figure";

const SRC = "https://cdn.sanity.io/images/p/d/abc-1200x800.jpg";

describe("Figure", () => {
  it("renders the image named by its alt, caption in the figcaption", () => {
    const { container } = render(
      <Figure
        src={SRC}
        alt="A diagram"
        width={1200}
        height={800}
        caption="Fig. 1"
      />,
    );
    const img = screen.getByRole("img", { name: "A diagram" });
    expect(img.tagName).toBe("IMG");
    expect(container.querySelector("figcaption")).toHaveTextContent("Fig. 1");
    expect(screen.getAllByText("Fig. 1")).toHaveLength(1);
  });

  it("omits the figcaption when the caption is absent or blank", () => {
    const { container } = render(
      <Figure
        src={SRC}
        alt="A diagram"
        width={1200}
        height={800}
        caption="   "
      />,
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("reserves the box — width/height land on the img", () => {
    render(<Figure src={SRC} alt="A diagram" width={1200} height={800} />);
    const img = screen.getByRole("img", { name: "A diagram" });
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("800");
  });

  it("blurs up only when blur data is provided", () => {
    const { unmount } = render(
      <Figure
        src={SRC}
        alt="A diagram"
        width={1200}
        height={800}
        blurDataURL="data:image/jpeg;base64,LQIP"
      />,
    );
    expect(
      screen.getByRole("img", { name: "A diagram" }).style.backgroundImage,
    ).not.toBe("");
    unmount();
    render(<Figure src={SRC} alt="A diagram" width={1200} height={800} />);
    expect(
      screen.getByRole("img", { name: "A diagram" }).style.backgroundImage,
    ).toBe("");
  });

  it("lazy-loads by default and switches eager when preloaded", () => {
    const { unmount } = render(
      <Figure src={SRC} alt="A diagram" width={1200} height={800} />,
    );
    expect(screen.getByRole("img", { name: "A diagram" })).toHaveAttribute(
      "loading",
      "lazy",
    );
    unmount();
    render(
      <Figure src={SRC} alt="A diagram" width={1200} height={800} preload />,
    );
    expect(screen.getByRole("img", { name: "A diagram" })).not.toHaveAttribute(
      "loading",
      "lazy",
    );
  });

  // QA — the lane contract: the figure stamps `data-lane` for the content grid's attribute
  // mapping, defaulting to the wide media breakout.
  it("stamps data-lane='wide' by default (the media breakout)", () => {
    const { container } = render(
      <Figure src={SRC} alt="A diagram" width={1200} height={800} />,
    );
    expect(container.querySelector("figure")).toHaveAttribute(
      "data-lane",
      "wide",
    );
  });

  it("stamps the caller's lane on the figure itself", () => {
    const { container } = render(
      <Figure
        src={SRC}
        alt="A diagram"
        width={1200}
        height={800}
        lane="full"
      />,
    );
    expect(container.querySelector("figure")).toHaveAttribute(
      "data-lane",
      "full",
    );
  });
});
