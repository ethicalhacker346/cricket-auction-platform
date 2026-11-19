import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auction, franchise, makePlayer, makeSnapshot } from "@/test/auctionFixtures";
import { auctionApi } from "../api/index.api";
import { AuctionEngine } from "./AuctionEngine";

// The public connect/reconcile flow runs for real; only transport is faked.
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => {
    const socket = {
      on: vi.fn((name: string, listener: () => void) => {
        if (name === "connect") queueMicrotask(listener);
        return socket;
      }),
      emit: vi.fn(),
      removeAllListeners: vi.fn(),
      disconnect: vi.fn(),
    };
    return socket;
  }),
}));

let engine: AuctionEngine;
beforeEach(() => { vi.useFakeTimers(); engine = new AuctionEngine(); });
afterEach(() => engine.destroy());

describe("engine verdict detection", () => {
  it("treats historical sold/unsold outcomes in the first snapshot as baseline, not new verdicts", async () => {
    vi.spyOn(auctionApi, "getSnapshot").mockResolvedValue(makeSnapshot({
      players: [
        makePlayer({ status: "sold", teamId: franchise.id, soldPrice: 250_000 }),
        makePlayer({ id: "player-b", status: "unsold" }),
      ],
      currentPlayerId: null,
    }));
    await engine.connect(auction.id, auction.tournamentId);
    expect(engine.getSnapshot().soldEvent).toBeNull();
    expect(engine.getSnapshot().unsoldEvent).toBeNull();
  });

  it.each(["sold", "unsold"] as const)("detects a real %s transition via REST fallback exactly once", async (status) => {
    const getSnapshot = vi.spyOn(auctionApi, "getSnapshot").mockResolvedValue(makeSnapshot());
    await engine.connect(auction.id, auction.tournamentId);
    getSnapshot.mockResolvedValue(makeSnapshot({
      version: 2,
      players: [makePlayer({ status, teamId: franchise.id, soldPrice: 250_000 })],
      currentPlayerId: null,
      timer: { remaining: 0, total: 30, isRunning: false },
    }));
    await vi.advanceTimersByTimeAsync(10_000);
    const event = status === "sold" ? engine.getSnapshot().soldEvent : engine.getSnapshot().unsoldEvent;
    expect(event?.playerId).toBe("player-a");
    expect(event?.seq).toBe(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(status === "sold" ? engine.getSnapshot().soldEvent : engine.getSnapshot().unsoldEvent).toEqual(event);
  });

  it("does not compare the new auction's history with the previous auction's players", async () => {
    const getSnapshot = vi.spyOn(auctionApi, "getSnapshot").mockResolvedValue(makeSnapshot());
    await engine.connect(auction.id, auction.tournamentId);
    getSnapshot.mockResolvedValue(makeSnapshot({
      auction: { ...auction, id: "auction-b" },
      version: 2,
      players: [makePlayer({ status: "sold", teamId: franchise.id, soldPrice: 250_000 })],
      currentPlayerId: null,
    }));
    await engine.connect("auction-b", auction.tournamentId);
    expect(engine.getSnapshot().soldEvent).toBeNull();
  });
});
