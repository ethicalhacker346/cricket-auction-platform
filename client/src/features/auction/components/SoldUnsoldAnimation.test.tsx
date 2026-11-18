import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auction, franchise, makePlayer } from "@/test/auctionFixtures";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { SoldUnsoldAnimation, SoldUnsoldAnimationView } from "./SoldUnsoldAnimation";

function sell(seq = 1) {
  act(() => useLiveAuctionStore.setState({
    players: [makePlayer({ status: "sold", teamId: franchise.id, soldPrice: 250_000 })],
    currentPlayerId: null,
    soldEvent: { playerId: "player-a", teamId: franchise.id, amount: 250_000, seq },
  }));
}

function ClockDrivenPage() {
  const timer = useLiveAuctionStore((s) => s.timer);
  return <div data-remaining={timer.remaining}><SoldUnsoldAnimation /></div>;
}

async function flushExit() {
  await act(async () => { await vi.advanceTimersByTimeAsync(350); });
  // Assert physical removal, not just aria-hidden on an exiting overlay.
  expect(document.querySelector('[role="dialog"][aria-hidden="true"]')).toBeNull();
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem("auction_audio_muted", "true");
  useLiveAuctionStore.setState({
    ...useLiveAuctionStore.getInitialState(),
    auction,
    auctionId: auction.id,
    tournamentId: auction.tournamentId,
    players: [makePlayer()],
    franchises: [franchise],
    currentPlayerId: "player-a",
  }, true);
});

describe("store-connected verdict overlay", () => {
  it("renders nothing until a new verdict, then shows the real player, team and price", async () => {
    render(<SoldUnsoldAnimation />);
    expect(screen.queryByRole("dialog")).toBeNull();
    sell();
    expect(screen.getByRole("dialog", { name: "Asha Rao sold" })).toBeTruthy();
    expect(screen.getByText("Coastal Strikers")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText("₹2.5 L")).toBeTruthy();
  });

  it("cross dismisses and repeated timer/snapshot updates never resurrect the same event", async () => {
    render(<SoldUnsoldAnimation />);
    sell();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await flushExit();
    expect(screen.queryByRole("dialog")).toBeNull();
    for (let i = 0; i < 5; i++) {
      act(() => useLiveAuctionStore.setState((s) => ({
        players: s.players.map((p) => ({ ...p })),
        soldEvent: s.soldEvent ? { ...s.soldEvent } : null,
        timer: { ...s.timer, remaining: i },
      })));
    }
    await flushExit();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores old verdicts already in the store when a page is mounted, including StrictMode", () => {
    sell();
    render(<StrictMode><SoldUnsoldAnimation /></StrictMode>);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("auto-dismisses on its original deadline despite 250ms store updates", async () => {
    render(<StrictMode><ClockDrivenPage /></StrictMode>);
    sell();
    for (let i = 0; i < 16; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
        useLiveAuctionStore.setState((s) => ({
          players: s.players.map((p) => ({ ...p })),
          soldEvent: s.soldEvent ? { ...s.soldEvent } : null,
          timer: { ...s.timer, remaining: 30 - i },
        }));
      });
    }
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(["escape", "backdrop"])("dismisses with %s", async (method) => {
    render(<SoldUnsoldAnimation />);
    sell();
    if (method === "escape") fireEvent.keyDown(window, { key: "Escape" });
    else fireEvent.click(screen.getByRole("dialog"));
    await flushExit();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a new sequence opens the next verdict and supersedes the previous one", async () => {
    render(<SoldUnsoldAnimation />);
    sell();
    act(() => useLiveAuctionStore.setState({
      players: [makePlayer({ id: "player-b", name: "Bina Shah", status: "unsold" })],
      unsoldEvent: { playerId: "player-b", seq: 2 },
    }));
    await flushExit();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Bina Shah unsold" })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(3200); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("dismisses when a different lot opens or the auction context changes", async () => {
    render(<SoldUnsoldAnimation />);
    sell();
    act(() => useLiveAuctionStore.setState({ currentPlayerId: "player-b" }));
    await flushExit();
    expect(screen.queryByRole("dialog")).toBeNull();
    sell(2);
    expect(screen.getByRole("dialog")).toBeTruthy();
    act(() => useLiveAuctionStore.setState({ auctionId: "auction-b" }));
    await flushExit();
    expect(screen.queryByRole("dialog")).toBeNull();
  });


  it("focuses Dismiss, contains Tab/focus, then restores the previous focus and scroll", async () => {
    document.body.style.overflow = "clip";
    render(<><button>Open next lot</button><SoldUnsoldAnimation /></>);
    const trigger = screen.getByRole("button", { name: "Open next lot" });
    trigger.focus();
    sell();
    const close = screen.getByRole("button", { name: "Dismiss" });
    const mute = screen.getByRole("button", { name: "Unmute sound" });
    expect(document.activeElement).toBe(close);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(mute);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(close);
    trigger.focus();
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    await flushExit();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("clip");
  });

  it("card clicks and mute do not dismiss the verdict or reset its deadline", async () => {
    render(<SoldUnsoldAnimation enableSound={false} />);
    sell();
    fireEvent.click(screen.getByText("Asha Rao"));
    await act(async () => { await vi.advanceTimersByTimeAsync(3800); });
    fireEvent.click(screen.getByRole("button", { name: "Unmute sound" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("freezes reveal data across roster reconciliation and waits for a missing player", async () => {
    render(<SoldUnsoldAnimation />);
    act(() => useLiveAuctionStore.setState({
      players: [],
      soldEvent: { playerId: "player-a", teamId: franchise.id, amount: 250_000, seq: 1 },
    }));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => useLiveAuctionStore.setState({ players: [makePlayer({ status: "sold" })] }));
    expect(screen.getByRole("dialog", { name: "Asha Rao sold" })).toBeTruthy();
    act(() => useLiveAuctionStore.setState({ players: [], franchises: [] }));
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("Coastal Strikers")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await flushExit();
  });

  it("the old sold timeout cannot dismiss a newer sold event", async () => {
    render(<SoldUnsoldAnimation />);
    sell();
    await act(async () => { await vi.advanceTimersByTimeAsync(3900); });
    sell(2);
    await flushExit();
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(screen.getByRole("dialog", { name: "Asha Rao sold" })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(3400); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("closes even if the same unsold player is immediately re-listed", async () => {
    render(<SoldUnsoldAnimation />);
    act(() => useLiveAuctionStore.setState({
      currentPlayerId: null,
      unsoldEvent: { playerId: "player-a", seq: 1 },
    }));
    expect(screen.getByRole("dialog", { name: "Asha Rao unsold" })).toBeTruthy();
    act(() => useLiveAuctionStore.setState({ currentPlayerId: "player-a" }));
    await flushExit();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("moves into fullscreen without remounting or restarting the countdown", async () => {
    const room = document.createElement("div");
    document.body.appendChild(room);
    const { unmount } = render(<SoldUnsoldAnimation />);
    try {
      sell();
      const originalDialog = screen.getByRole("dialog");
      await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
      Object.defineProperty(document, "fullscreenElement", { configurable: true, value: room });
      fireEvent(document, new Event("fullscreenchange"));
      expect(room.contains(originalDialog)).toBe(true);
      expect(screen.getByRole("dialog")).toBe(originalDialog);
      await act(async () => { await vi.advanceTimersByTimeAsync(1050); });
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      unmount();
      Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
      room.remove();
    }
    expect(document.querySelector("[data-auction-verdict-portal]")).toBeNull();
  });

  it("cleans up a visible overlay when the page unmounts", () => {
    const { unmount } = render(<SoldUnsoldAnimation />);
    sell();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector("[data-auction-verdict-portal]")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });


  it("replaces a broken franchise logo with initials without affecting dismissal", async () => {
    act(() => useLiveAuctionStore.setState({ franchises: [{ ...franchise, logo: "https://example.com/missing-logo.png" }] }));
    render(<SoldUnsoldAnimation />);
    sell();
    fireEvent.error(screen.getByRole("img", { name: "Coastal Strikers" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("CO")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await flushExit();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows only the latest verdict when sold and unsold arrive in one catch-up snapshot", () => {
    render(<SoldUnsoldAnimation />);
    act(() => useLiveAuctionStore.setState({
      currentPlayerId: null,
      soldEvent: { playerId: "player-a", teamId: franchise.id, amount: 250_000, seq: 4 },
      unsoldEvent: { playerId: "player-a", seq: 5 },
    }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Asha Rao unsold" })).toBeTruthy();
  });

  it("resets its sequence baseline when switching to a fresh auction", async () => {
    render(<SoldUnsoldAnimation />);
    sell(20);
    act(() => useLiveAuctionStore.setState({
      auctionId: "auction-b", auction: { ...auction, id: "auction-b" }, soldEvent: null, unsoldEvent: null,
    }));
    await flushExit();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    sell(1);
    expect(screen.getByRole("dialog", { name: "Asha Rao sold" })).toBeTruthy();
  });

});


describe("strict presentational verdict contract", () => {
  it("uses the latest close callback without extending its original deadline", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <SoldUnsoldAnimationView playerName="Asha Rao" isSold onClose={first} enableSound={false} />,
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    rerender(<SoldUnsoldAnimationView playerName="Asha Rao" isSold onClose={second} enableSound={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
