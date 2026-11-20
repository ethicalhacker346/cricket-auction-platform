import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResilientImage } from "./ResilientImage";

describe("network-independent image surfaces", () => {
  it("reserves its image geometry and keeps a useful fallback until load", () => {
    const { container } = render(
      <ResilientImage
        src="/crest.webp"
        alt="GullyBid crest"
        width={256}
        height={256}
        fetchPriority="high"
        fallback={<span>GB</span>}
      />,
    );
    const surface = screen.getByRole("img", { name: "GullyBid crest" });
    const image = container.querySelector("img")!;
    expect(surface.getAttribute("data-image-state")).toBe("loading");
    expect(image.getAttribute("width")).toBe("256");
    expect(image.getAttribute("height")).toBe("256");
    expect(surface.style.aspectRatio).toBe("256 / 256");
    expect(image.getAttribute("fetchpriority")).toBe("high");
    expect(screen.getByText("GB")).toBeTruthy();
    fireEvent.load(image);
    expect(surface.getAttribute("data-image-state")).toBe("ready");
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
  it("does not remove a slow image or its fallback after an arbitrary timeout", () => {
    vi.useFakeTimers();
    render(
      <ResilientImage src="/slow.webp" alt="Still loading" fallback="GB" />,
    );
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("img").getAttribute("data-image-state")).toBe(
      "loading",
    );
    expect(screen.getByText("GB")).toBeTruthy();
  });
  it("removes the broken image, not the brand or accessible description", () => {
    const { container } = render(
      <ResilientImage
        src="/unavailable.webp"
        alt="Creator portrait"
        fallback="VS"
      />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(
      screen
        .getByRole("img", { name: "Creator portrait" })
        .getAttribute("data-image-state"),
    ).toBe("error");
    expect(screen.getByText("VS")).toBeTruthy();
  });
  it("resets both error and ready state when the source or srcset changes", () => {
    const { container, rerender } = render(
      <ResilientImage src="/one.webp" alt="Photo" />,
    );
    fireEvent.error(container.querySelector("img")!);
    rerender(<ResilientImage src="/two.webp" alt="Photo" />);
    expect(screen.getByRole("img").getAttribute("data-image-state")).toBe(
      "loading",
    );
    fireEvent.load(container.querySelector("img")!);
    rerender(
      <ResilientImage
        src="/two.webp"
        srcSet="/two-large.webp 2x"
        alt="Photo"
      />,
    );
    expect(screen.getByRole("img").getAttribute("data-image-state")).toBe(
      "loading",
    );
  });
  it("recognizes an already-cached successful load", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
      true,
    );
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
      256,
    );
    render(<ResilientImage src="/cached.webp" alt="Cached crest" />);
    expect(screen.getByRole("img").getAttribute("data-image-state")).toBe(
      "ready",
    );
  });
  it("recognizes cached failures and excludes decorative art from the accessibility tree", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
      true,
    );
    const { container } = render(<ResilientImage src="/missing.webp" alt="" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(
      container
        .querySelector("[data-image-state='error']")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
});
