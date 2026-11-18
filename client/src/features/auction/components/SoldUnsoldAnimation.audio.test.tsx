import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserAudioMock } from "@/test/browserAudioMock";
import { auction, franchise, makePlayer } from "@/test/auctionFixtures";
import { useLiveAuctionStore } from "../store/index.store";
import { setAuctionAudioMuted } from "../audio/audioPreference";
import { AuctionAudioManager } from "../audio/AuctionAudioManager";
import { SoldUnsoldAnimation } from "./SoldUnsoldAnimation";

const audio = createBrowserAudioMock();

function verdict(isSold = true, seq = 1) {
  act(() => useLiveAuctionStore.setState({
    currentPlayerId: null,
    ...(isSold
      ? { soldEvent: { playerId: "player-a", teamId: franchise.id, amount: 250_000, seq } }
      : { unsoldEvent: { playerId: "player-a", seq } }),
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  audio.install();
  setAuctionAudioMuted(false);
  useLiveAuctionStore.setState({
    ...useLiveAuctionStore.getInitialState(), auction, auctionId: auction.id,
    tournamentId: auction.tournamentId, players: [makePlayer()], franchises: [franchise],
  }, true);
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("verdict audio ownership", () => {
  it.each([true, false])("synthesizes %s with AudioParam automation and stops on cross", (isSold) => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<SoldUnsoldAnimation />);
    verdict(isSold);
    expect(audio.sources().length).toBeGreaterThan(0);
    expect(audio.sources().every((source) => source.start.mock.calls.length === 1)).toBe(true);
    expect(warnings).not.toHaveBeenCalled();
    expect(audio.speech.speak).toHaveBeenCalledTimes(1);
    expect(audio.speech.speak.mock.calls[0][0].text).toContain(isSold ? "rupees 2.5 lakh" : "goes unsold");
    const comp = audio.nodes.find((node) => node.kind === "compressor")!;
    const cancelBefore = audio.speech.cancel.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(comp.disconnect).toHaveBeenCalledTimes(1);
    expect(audio.speech.cancel.mock.calls.length).toBeGreaterThan(cancelBefore);
  });

  it("same-tab mute updates the reveal AND mounted manager, and does not close the dialog", () => {
    const manager = new AuctionAudioManager();
    try {
      render(<SoldUnsoldAnimation />);
      verdict();
      const cancelBefore = audio.speech.cancel.mock.calls.length;
      fireEvent.click(screen.getByRole("button", { name: "Mute sound" }));
      expect(manager.muted).toBe(true);
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(audio.speech.cancel.mock.calls.length).toBeGreaterThan(cancelBefore);
      expect(audio.nodes.find((node) => node.kind === "compressor")!.disconnect).toHaveBeenCalled();
      act(() => manager.setMuted(false));
      expect(screen.getByRole("button", { name: "Mute sound" })).toBeTruthy();
    } finally {
      manager.destroy();
    }
  });

  it("a disabled audio device cannot break the reveal or its close button", () => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    audio.state.failGain = true;
    render(<SoldUnsoldAnimation />);
    verdict(false);
    expect(warnings).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Asha Rao unsold" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("falls back to a dry score when reverb is unsupported", () => {
    audio.state.failReverb = true;
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<SoldUnsoldAnimation />);
    verdict();
    expect(audio.sources().length).toBeGreaterThan(0);
    expect(warnings).not.toHaveBeenCalled();
  });

  it("reconciliation neither replays nor replaces the score and unmount cancels speech", () => {
    const { unmount } = render(<SoldUnsoldAnimation />);
    verdict();
    const sourceCount = audio.sources().length;
    act(() => useLiveAuctionStore.setState((s) => ({
      players: s.players.map((p) => ({ ...p })),
      franchises: s.franchises.map((f) => ({ ...f })),
      soldEvent: s.soldEvent ? { ...s.soldEvent } : null,
    })));
    expect(audio.sources()).toHaveLength(sourceCount);
    expect(audio.speech.speak).toHaveBeenCalledTimes(1);
    const cancelBefore = audio.speech.cancel.mock.calls.length;
    unmount();
    expect(audio.speech.cancel.mock.calls.length).toBeGreaterThan(cancelBefore);
  });
});
