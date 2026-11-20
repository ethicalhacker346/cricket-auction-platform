import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AuctionDialog } from "./AuctionDialog";
import { SoldUnsoldAnimationView } from "./SoldUnsoldAnimation";
import {
  isTopAuctionModal,
  lockAuctionScroll,
  topAuctionModal,
} from "../utils/modalFocus";

it("gives only the top confirmation focus and Escape ownership when dialogs overlap", async () => {
  const firstClose = vi.fn();
  const secondClose = vi.fn();
  const first = (
    <AuctionDialog key="first" title="First confirmation" onClose={firstClose}>
      <button>First action</button>
    </AuctionDialog>
  );
  const second = (
    <AuctionDialog
      key="second"
      title="Second confirmation"
      onClose={secondClose}
    >
      <button>Second action</button>
    </AuctionDialog>
  );
  const { rerender, unmount } = render(
    <>
      {first}
      {second}
    </>,
  );
  const lower = screen.getByRole("dialog", { name: "First confirmation" });
  const upper = screen.getByRole("dialog", { name: "Second confirmation" });
  expect(topAuctionModal()).toBe(upper);
  expect(isTopAuctionModal(lower)).toBe(false);
  expect(upper.contains(document.activeElement)).toBe(true);
  // A second independent trap used to bounce focus synchronously forever.
  within(lower).getByRole("button", { name: "First action" }).focus();
  expect(upper.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(secondClose).toHaveBeenCalledTimes(1);
  expect(firstClose).not.toHaveBeenCalled();
  rerender(<>{first}</>);
  await act(async () => {});
  expect(topAuctionModal()).toBe(lower);
  expect(lower.contains(document.activeElement)).toBe(true);
  expect(document.body.style.overflow).toBe("hidden");
  unmount();
  expect(document.body.style.overflow).toBe("");
});

it("a late cinematic verdict never steals focus or Escape from an organizer confirmation", async () => {
  const decisionClose = vi.fn();
  const verdictClose = vi.fn();
  const decision = (
    <AuctionDialog
      key="decision"
      title="Review latest action"
      onClose={decisionClose}
    >
      <button>Confirm decision</button>
    </AuctionDialog>
  );
  const verdict = (
    <SoldUnsoldAnimationView
      key="verdict"
      playerName="Asha Rao"
      isSold={false}
      onClose={verdictClose}
      enableSound={false}
      autoDismissMs={60000}
    />
  );
  const { rerender } = render(<>{decision}</>);
  const dialog = screen.getByRole("dialog", { name: "Review latest action" });
  rerender(
    <>
      {decision}
      {verdict}
    </>,
  );
  expect(topAuctionModal()).toBe(dialog);
  expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(
    within(dialog).getByRole("button", { name: "Confirm decision" }),
    { key: "Escape" },
  );
  expect(decisionClose).toHaveBeenCalledTimes(1);
  expect(verdictClose).not.toHaveBeenCalled();
  rerender(<>{decision}</>);
  await act(async () => {});
  expect(document.body.style.overflow).toBe("hidden");
  expect(dialog.contains(document.activeElement)).toBe(true);
});

it("scroll locks are released once and restore the original value in either close order", () => {
  document.body.style.overflow = "clip";
  const releaseFirst = lockAuctionScroll();
  const releaseSecond = lockAuctionScroll();
  releaseFirst();
  releaseFirst();
  expect(document.body.style.overflow).toBe("hidden");
  releaseSecond();
  expect(document.body.style.overflow).toBe("clip");
});
