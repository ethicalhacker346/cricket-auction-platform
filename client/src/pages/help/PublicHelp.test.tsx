import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PrivacyPage from "@/pages/legal/PrivacyPage";

// JSDOM has no viewport observer. Keep the real motion components; decorative
// in-view transitions are exercised in the real-browser acceptance checks.
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
import FAQPage from "./FAQPage";
import BiddingRulesPage from "./BiddingRulesPage";
import SquadRulesPage from "./SquadRulesPage";

it("describes the actual persisted session and public cache instead of the removed splash gate", () => {
  const { container } = render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );
  const storage = container.querySelector("#cookies");
  expect(storage?.textContent).toContain("gullybid-auth");
  expect(storage?.textContent).toContain("in local storage");
  expect(storage?.textContent).toContain("refresh token");
  expect(storage?.textContent).toContain("not API responses");
  expect(storage?.textContent).not.toMatch(
    /app-opening-seen|in-memory only|never localStorage/,
  );
});

describe("accessible public help tools", () => {
  it("keeps FAQ expansion attached to the question, not a filtered array index", async () => {
    render(<FAQPage />);
    const first = screen.getByRole("button", {
      name: /Why can't I place a bid/,
    });
    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    const panel = await screen.findByRole("region", {
      name: /Why can't I place a bid/,
    });
    expect(panel.id).toBe(first.getAttribute("aria-controls"));

    fireEvent.click(screen.getByRole("button", { name: /^Auctions/ }));
    const question = await screen.findByRole("button", {
      name: /How do unsold rounds work/,
    });
    expect(question.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen
        .getByRole("button", { name: /^Auctions/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(question);
    expect(
      (await screen.findByRole("region", { name: /How do unsold rounds work/ }))
        .textContent,
    ).toContain("Unsold Round-3");

    fireEvent.change(
      screen.getByRole("searchbox", { name: /Search frequently/ }),
      { target: { value: "  unsold rounds  " } },
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "1 matching questions",
      ),
    );
    expect(
      screen
        .getByRole("button", { name: /How do unsold rounds work/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "no matching question" },
    });
    expect(screen.getByRole("status").textContent).toBe("0 matching questions");
    expect(screen.getByText(/No questions found/)).toBeTruthy();
  });

  it("labels the wallet sliders and keeps reservations and free budget nonnegative", () => {
    const { container } = render(<BiddingRulesPage />);
    const spent = screen.getByRole("slider", {
      name: /Spent Budget/,
    }) as HTMLInputElement;
    const reserved = screen.getByRole("slider", {
      name: /Reserved Budget/,
    }) as HTMLInputElement;
    fireEvent.change(spent, { target: { value: "5000000" } });
    expect(reserved.value).toBe("0");
    expect(reserved.max).toBe("0");
    const legend = container.querySelector(".grid-cols-3")!;
    expect(legend.textContent).not.toMatch(/-₹|₹-|NaN|Infinity/);
    expect(within(legend as HTMLElement).getAllByText("₹0")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(spent.value).toBe("1200000");
    expect(reserved.value).toBe("800000");
  });

  it("labels and bounds every calculator field and distinguishes examples from live data", () => {
    render(<BiddingRulesPage />);
    expect(screen.getByText(/Illustrative calculator/)).toBeTruthy();
    const base = screen.getByRole("spinbutton", {
      name: "Base Price",
    }) as HTMLInputElement;
    const current = screen.getByRole("spinbutton", {
      name: "Current Bid",
    }) as HTMLInputElement;
    const increment = screen.getByRole("spinbutton", {
      name: "Increment",
    }) as HTMLInputElement;
    fireEvent.change(base, { target: { value: "-5" } });
    expect(base.value).toBe("0");
    fireEvent.change(current, { target: { value: "500000" } });
    fireEvent.change(increment, { target: { value: "25000" } });
    expect(screen.getByText("₹5,25,000")).toBeTruthy();
    fireEvent.change(increment, { target: { value: "1000000000000000" } });
    expect(increment.value).toBe("1000000000000");
  });

  it("uses one affordable squad example without negative budget or division by zero", () => {
    const { container } = render(<SquadRulesPage />);
    expect(
      screen.getByText("Example squad · 11 of 15 slots filled"),
    ).toBeTruthy();
    expect(screen.getAllByText("Empty")).toHaveLength(4);
    expect(container.textContent).not.toMatch(/NaN|Infinity|₹-/);
    const strategy = screen.getByText(/With 4 slots left/);
    expect(strategy.textContent).toContain("₹20,00,000 remaining");
    expect(strategy.textContent).toContain("₹5,00,000");
  });
});
