import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makePlayer } from "@/test/auctionFixtures";
import { PlayerAuctionCard } from "./PlayerAuctionCard";

describe("PlayerAuctionCard lifecycle", () => {
  it("keeps hook order stable across empty → player → empty → another player", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <StrictMode><PlayerAuctionCard player={null} /></StrictMode>,
    );
    expect(screen.getByText("No player under the hammer")).toBeTruthy();

    rerender(<StrictMode><PlayerAuctionCard player={makePlayer()} /></StrictMode>);
    expect(screen.getByText("Asha Rao")).toBeTruthy();

    rerender(<StrictMode><PlayerAuctionCard player={null} compact /></StrictMode>);
    expect(screen.getByText("No player under the hammer")).toBeTruthy();

    rerender(
      <StrictMode>
        <PlayerAuctionCard player={makePlayer({ id: "player-b", name: "Bina Shah" })} compact />
      </StrictMode>,
    );
    expect(screen.getByText("Bina Shah")).toBeTruthy();
    expect(errors.mock.calls).toEqual([]);
  });

  it("falls back on image failure and recovers for the next player's image", () => {
    const first = makePlayer({ profileImage: "https://example.com/first.png" });
    const { rerender } = render(<PlayerAuctionCard player={first} />);
    fireEvent.error(screen.getByRole("img", { name: "Asha Rao" }));
    expect(screen.queryByRole("img", { name: "Asha Rao" })).toBeNull();
    expect(screen.getByText("AR")).toBeTruthy();

    rerender(<PlayerAuctionCard player={null} />);
    rerender(
      <PlayerAuctionCard player={makePlayer({ id: "player-b", name: "Bina Shah", profileImage: "https://example.com/second.png" })} />,
    );
    expect(screen.getByRole("img", { name: "Bina Shah" }).getAttribute("src")).toBe("https://example.com/second.png");
  });
});
