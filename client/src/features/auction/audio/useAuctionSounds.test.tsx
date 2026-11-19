import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserAudioMock } from "@/test/browserAudioMock";
import { useLiveAuctionStore } from "../store/index.store";
import { AuctionAudioManager } from "./AuctionAudioManager";
import { auctionEventBus } from "./EventBus";
import { getAuctionAudioMuted, setAuctionAudioMuted } from "./audioPreference";
import { useAuctionSounds } from "./useAuctionSounds";

const audio = createBrowserAudioMock();

function SoundControls() {
  const { muted, toggleMute } = useAuctionSounds();
  return <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>;
}

beforeEach(() => {
  audio.install();
  setAuctionAudioMuted(false);
  useLiveAuctionStore.setState(useLiveAuctionStore.getInitialState(), true);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("auction audio lifecycle", () => {
  it("StrictMode leaves exactly one active manager; unmount removes store and gesture listeners", () => {
    const events = vi.spyOn(auctionEventBus, "on");
    const destroy = vi.spyOn(AuctionAudioManager.prototype, "destroy");
    const timer = vi.spyOn(AuctionAudioManager.prototype, "onTimerUpdate");
    const { unmount } = render(<StrictMode><SoundControls /></StrictMode>);
    expect(events).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1);
    act(() => useLiveAuctionStore.setState({ timer: { remaining: 10, total: 30, isRunning: true } }));
    expect(timer).toHaveBeenCalledTimes(1);
    fireEvent.click(document);
    expect(audio.AudioContext).toHaveBeenCalledTimes(1);
    unmount();
    expect(destroy).toHaveBeenCalledTimes(2);
    const calls = timer.mock.calls.length;
    act(() => useLiveAuctionStore.setState({ timer: { remaining: 9, total: 30, isRunning: true } }));
    fireEvent.click(document);
    expect(timer).toHaveBeenCalledTimes(calls);
    expect(audio.AudioContext).toHaveBeenCalledTimes(1);
  });

  it("destroy before the first gesture cannot resurrect an AudioContext", () => {
    const manager = new AuctionAudioManager();
    manager.destroy();
    manager.destroy();
    fireEvent.click(document);
    fireEvent.keyDown(document, { key: "Enter" });
    manager.onTimerUpdate(3);
    expect(audio.AudioContext).not.toHaveBeenCalled();
  });

  it("handles corrupt/blocked storage, including an in-session mute", () => {
    localStorage.setItem("auction_audio_muted", "not-json");
    const manager = new AuctionAudioManager();
    expect(manager.muted).toBe(false);
    manager.destroy();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage blocked"); });
    render(<SoundControls />);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(getAuctionAudioMuted()).toBe(true);
    expect(screen.getByRole("button", { name: "Unmute" })).toBeTruthy();
  });

  it("reacts to cross-tab mute updates", () => {
    render(<SoundControls />);
    localStorage.setItem("auction_audio_muted", "true");
    fireEvent(window, new StorageEvent("storage", { key: "auction_audio_muted", newValue: "true" }));
    expect(screen.getByRole("button", { name: "Unmute" })).toBeTruthy();
  });

  it("plays the live event voices without calling AudioParam methods on a node", () => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const manager = new AuctionAudioManager();
    const meta = { id: "test", auctionId: "auction-a", timestamp: Date.now() };
    try {
      auctionEventBus.emit({ type: "LOT_OPENED", meta: { ...meta, id: "open" }, payload: { playerName: "Asha" } });
      auctionEventBus.emit({ type: "BID_PLACED", meta: { ...meta, id: "bid" }, payload: { amount: 1000, teamName: "Coastal", isFirstBid: true } });
      auctionEventBus.emit({ type: "LOT_SOLD", meta: { ...meta, id: "sold" }, payload: { playerName: "Asha", teamName: "Coastal", amount: 1000 } });
      auctionEventBus.emit({ type: "LOT_UNSOLD", meta: { ...meta, id: "unsold" }, payload: { playerName: "Asha" } });
      auctionEventBus.emit({ type: "AUCTION_STARTED", meta: { ...meta, id: "start" } });
      auctionEventBus.emit({ type: "AUCTION_PAUSED", meta: { ...meta, id: "pause" } });
      auctionEventBus.emit({ type: "AUCTION_RESUMED", meta: { ...meta, id: "resume" } });
      auctionEventBus.emit({ type: "ROUND_COMPLETED", meta: { ...meta, id: "round" }, payload: { roundName: "Batters" } });
      manager.onTimerUpdate(5);
      manager.onTimerUpdate(1);
      manager.onTimerUpdate(0);
      expect(audio.sources().length).toBeGreaterThan(15);
      expect(warnings).not.toHaveBeenCalled();
    } finally {
      manager.destroy();
    }
  });
});
