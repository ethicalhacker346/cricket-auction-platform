import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { expect, it } from "vitest";
import { auction, franchise, makePlayer } from "@/test/auctionFixtures";
import { useLiveAuctionStore } from "../store/index.store";
import { SoldUnsoldAnimation } from "./SoldUnsoldAnimation";

// Deliberately isolated from the fake-clock suite: Framer's frame scheduler
// captures requestAnimationFrame, so mixing timer implementations in one
// module graph can strand a scheduled frame. This uses real DOM animations.
it("physically removes a fully entered verdict after the real exit animation", async () => {
  MotionGlobalConfig.skipAnimations = false;
  localStorage.setItem("auction_audio_muted", "true");
  useLiveAuctionStore.setState({
    ...useLiveAuctionStore.getInitialState(),
    auction,
    auctionId: auction.id,
    tournamentId: auction.tournamentId,
    players: [makePlayer()],
    franchises: [franchise],
  }, true);
  render(<SoldUnsoldAnimation />);
  act(() => useLiveAuctionStore.setState({
    soldEvent: { playerId: "player-a", teamId: franchise.id, amount: 250_000, seq: 1 },
  }));
  const dialog = screen.getByRole("dialog", { name: "Asha Rao sold" });
  await waitFor(() => expect(dialog.style.opacity).toBe("1"));
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  await waitFor(() => {
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});
