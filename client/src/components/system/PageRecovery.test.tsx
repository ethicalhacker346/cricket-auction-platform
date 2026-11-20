import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageLoading } from "./PageLoading";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { pageTitle } from "./RouteEffects";

it("makes slow page downloads actionable rather than leaving an endless blank spinner", () => {
  vi.useFakeTimers();
  const { unmount } = render(<PageLoading />);
  expect(screen.getByRole("status").textContent).toContain(
    "Loading your next view",
  );
  expect(screen.queryByRole("button", { name: "Reload page" })).toBeNull();
  act(() => vi.advanceTimersByTime(8000));
  expect(screen.getByRole("status").textContent).toContain(
    "check your connection",
  );
  expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("announces offline/reconnection changes without automatically reloading the app", () => {
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  render(<PageLoading />);
  expect(screen.getByRole("status").textContent).toContain("YOU’RE OFFLINE");
  expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  online.mockReturnValue(true);
  fireEvent(window, new Event("online"));
  expect(screen.getByRole("status").textContent).toContain(
    "Loading your next view",
  );
});

it("contains route errors and can recover on a different route without remounting healthy routes", () => {
  const broken = () => {
    throw new Error("Failed to fetch dynamically imported module");
  };
  const Broken = broken;
  const { rerender } = render(
    <RouteErrorBoundary resetKey="/broken">
      <Broken />
    </RouteErrorBoundary>,
  );
  // This error is the intentionally exercised boundary, not an unexpected runtime error.
  expect(vi.mocked(console.error).mock.calls.length).toBeGreaterThan(0);
  vi.mocked(console.error).mockClear();
  expect(
    screen.getByRole("heading", { name: "This page couldn’t load." }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /Go home/ }).getAttribute("href"),
  ).toBe("/");
  expect(screen.getByRole("button", { name: /Reload page/ })).toBeTruthy();
  rerender(
    <RouteErrorBoundary resetKey="/new">
      <h1>Recovered route</h1>
    </RouteErrorBoundary>,
  );
  expect(screen.getByRole("heading", { name: "Recovered route" })).toBeTruthy();
});

describe("route document titles", () => {
  it.each([
    ["/", "Cricket auctions, reimagined"],
    ["/login", "Sign in"],
    ["/help", "Help center"],
    ["/privacy", "Privacy policy"],
    ["/creator", "Meet the creator"],
    ["/contact", "Get in touch"],
    ["/tournaments/t/auction/a/live/3d", "Auction room"],
    ["/admin/audit-logs", "Admin workspace"],
    ["/tournaments/t", "Tournament workspace"],
    ["/missing", "Page not found"],
  ])("names %s without exposing IDs or sensitive query data", (path, title) => {
    expect(pageTitle(path)).toBe(`${title} · GullyBid`);
  });
});
