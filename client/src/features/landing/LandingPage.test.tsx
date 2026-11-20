import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./LandingPage";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { useAuthStore } from "@/store/authStore";

beforeEach(() =>
  useAuthStore.setState({
    isAuthenticated: false,
    hasHydrated: true,
    user: null,
  }),
);
const mount = () =>
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );

describe("the public landing experience", () => {
  it("has real destinations, one page heading, an explicit preview label and creator credit", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen
        .getByRole("link", { name: /Build your tournament/ })
        .getAttribute("href"),
    ).toBe("/register?role=ORGANIZER");
    expect(
      screen
        .getByRole("link", { name: /Get to know the auction workflow/ })
        .getAttribute("href"),
    ).toBe("/help/auctions");
    expect(screen.getByText("ILLUSTRATIVE PREVIEW")).toBeTruthy();
    expect(screen.getByText("VENKAT SAI")).toBeTruthy();
    expect(
      screen.queryByText(/12,000|secure escrow|fastest-growing/i),
    ).toBeNull();
  });
  it("remains complete and actionable when every image fails, without a timed splash", () => {
    vi.useFakeTimers();
    const { container } = mount();
    for (const image of container.querySelectorAll("img"))
      fireEvent.error(image);
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Great squads",
    );
    expect(
      screen.getByRole("link", { name: /Build your tournament/ }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("img", { name: /GullyBid — Draft/ })
        .getAttribute("data-image-state"),
    ).toBe("error");
    expect(container.querySelector(".gb-intro")).toBeNull();
  });
  it("supports arrow, Home and End keys across role tabs, with role-specific links", () => {
    mount();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    let panel = screen.getByRole("tabpanel");
    expect(panel.id).toBe(tabs[1].getAttribute("aria-controls"));
    expect(within(panel).getByRole("link").getAttribute("href")).toBe(
      "/register?role=FRANCHISE_OWNER",
    );
    fireEvent.keyDown(tabs[1], { key: "End" });
    panel = screen.getByRole("tabpanel");
    expect(panel.textContent).toContain("read-only guest");
    expect(within(panel).getByRole("link").getAttribute("href")).toBe(
      "/register?role=PLAYER",
    );
    fireEvent.keyDown(tabs[2], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[2]);
    fireEvent.keyDown(tabs[2], { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);
  });
  it("offers real native FAQ disclosures and accurate guest/payment guidance", () => {
    const { container } = mount();
    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(4);
    expect(details[1].textContent).toContain("read-only");
    expect(details[2].textContent).toContain(
      "not a payment processor or an escrow service",
    );
    fireEvent.click(details[0].querySelector("summary")!);
    expect(details[0].open).toBe(true);
  });
});

describe("public navigation", () => {
  it("does not leave collapsed mobile links in the keyboard tree; Escape restores focus", () => {
    render(
      <MemoryRouter>
        <PublicHeader />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).toBeNull();
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(toggle);
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(nav.id).toBe(toggle.getAttribute("aria-controls"));
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    within(nav)
      .getByRole("link", { name: /The platform/ })
      .focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });
  it("closes when a destination is chosen or a pointer lands outside", () => {
    render(
      <MemoryRouter>
        <PublicHeader />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Mobile navigation" }),
      ).getByRole("link", { name: /How it works/ }),
    );
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).toBeNull();
  });
  it("uses a dashboard destination for signed-in visitors", () => {
    useAuthStore.setState({ isAuthenticated: true });
    render(
      <MemoryRouter>
        <PublicHeader />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: /Dashboard/ }).getAttribute("href"),
    ).toBe("/dashboard");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });
});
