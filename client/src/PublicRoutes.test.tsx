import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Outlet, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationRoutes } from "./App";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/api/authApi";
import type { AuthPayload, UserRole } from "@/types/auth";

vi.mock("@/pages/DashBoardPage", () => ({
  default: () => <h1>Your workspace</h1>,
}));
vi.mock("@/pages/AdminDashboardPage", () => ({
  AdminDashboardPage: () => <h1>Admin workspace</h1>,
}));
vi.mock("@/pages/NotificationsPage", () => ({
  NotificationsPage: () => <h1>Your notifications</h1>,
}));
vi.mock("@/pages/help/HelpCenterPage", () => ({
  default: () => <h1>Help center content</h1>,
}));
vi.mock("@/features/auction/layout/AuctionShell", () => ({
  AuctionShell: () => <Outlet />,
}));
vi.mock("@/features/auction/pages/LiveAuctionPage", () => ({
  default: () => <h1>Public live auction</h1>,
}));

const auth = (role: UserRole = "PLAYER"): AuthPayload => ({
  user: {
    _id: "test-user",
    name: "Cricket Fan",
    email: "fan@example.com",
    role,
    isActive: true,
    createdAt: "2026-11-18",
    updatedAt: "2026-11-18",
  },
  accessToken: "test-access",
  refreshToken: "test-refresh",
});
function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search + location.hash}
    </output>
  );
}
function mount(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ApplicationRoutes />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    hasHydrated: true,
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
});

it("serves a real home page to guests, with no forced intro or login redirect", async () => {
  mount("/");
  expect(
    (await screen.findByRole("heading", { level: 1 })).textContent,
  ).toContain("Great squads");
  expect(screen.getByTestId("location").textContent).toBe("/");
  expect(document.title).toBe("Cricket auctions, reimagined · GullyBid");
});

it("preserves the authenticated root destination", async () => {
  useAuthStore.setState({ ...auth(), isAuthenticated: true });
  mount("/");
  expect(
    await screen.findByRole("heading", { name: "Your workspace" }),
  ).toBeTruthy();
  expect(screen.getByTestId("location").textContent).toBe("/dashboard");
});

it("keeps help public and gives unknown routes a real 404, not another login form", async () => {
  const { unmount } = mount("/help");
  expect(
    await screen.findByRole("heading", { name: "Help center content" }),
  ).toBeTruthy();
  expect(screen.getByTestId("location").textContent).toBe("/help");
  expect(
    screen.getByRole("link", { name: "Skip to content" }).getAttribute("href"),
  ).toBe("#main-content");
  unmount();
  mount("/this-page-does-not-exist");
  expect(
    (await screen.findByRole("heading", { level: 1 })).textContent,
  ).toContain("over the rope");
  expect(screen.queryByRole("textbox", { name: "Email address" })).toBeNull();
});

it("does not put a splash or auth wall over a shared public auction deep link", async () => {
  mount("/tournaments/t/auction/a/live");
  expect(
    await screen.findByRole("heading", { name: "Public live auction" }),
  ).toBeTruthy();
  expect(screen.getByTestId("location").textContent).toBe(
    "/tournaments/t/auction/a/live",
  );
});

it("guards protected pages, validates fields accessibly, then returns to the intended deep link", async () => {
  const login = vi.spyOn(authApi, "login").mockResolvedValue(auth());
  mount("/notifications?filter=unread#latest");
  expect(
    await screen.findByRole("heading", { name: "Welcome back, captain" }),
  ).toBeTruthy();
  // Session persistence is the store's existing policy; an ignored remember
  // checkbox must not imply that unticking it protects a shared device.
  expect(screen.queryByRole("checkbox", { name: "Remember me" })).toBeNull();
  expect(screen.getByText("Sign out on shared devices.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
  expect(
    screen
      .getByRole("textbox", { name: "Email address" })
      .getAttribute("aria-invalid"),
  ).toBe("true");
  expect(login).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
    target: { value: "fan@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() =>
    expect(screen.getByTestId("location").textContent).toBe(
      "/notifications?filter=unread#latest",
    ),
  );
  expect(login).toHaveBeenCalledTimes(1);
  expect(login.mock.calls[0][0]).not.toHaveProperty("remember");
});

describe("registration role hints", () => {
  it.each([
    ["ORGANIZER", "ORGANIZER"],
    ["FRANCHISE_OWNER", "FRANCHISE_OWNER"],
    ["ADMIN", "PLAYER"],
  ])("%s selects only the permitted role %s", async (hint, expected) => {
    mount(`/register?role=${hint}`);
    await screen.findByRole("heading", {
      name: "Create your GullyBid account",
    });
    const selected = screen
      .getAllByRole("radio")
      .find(
        (element) => (element as HTMLInputElement).checked,
      ) as HTMLInputElement;
    expect(selected.value).toBe(expected);
    expect(
      screen
        .getByRole("link", { name: /Terms of Service/ })
        .getAttribute("href"),
    ).toBe("/terms");
  });
});

it("sends an ordinary admin sign-in to its existing admin workspace", async () => {
  vi.spyOn(authApi, "login").mockResolvedValue(auth("ADMIN"));
  mount("/login");
  await screen.findByRole("heading", { name: "Welcome back, captain" });
  fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
    target: { value: "admin@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(
    await screen.findByRole("heading", { name: "Admin workspace" }),
  ).toBeTruthy();
});

it("rejects malformed reset links locally instead of showing an enabled password form", async () => {
  const verify = vi.spyOn(authApi, "verifyResetToken");
  mount("/reset-password?token=not-a-valid-token");
  expect(
    await screen.findByRole("heading", { name: "This link is unavailable" }),
  ).toBeTruthy();
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(verify).not.toHaveBeenCalled();
});

it("waits for verification, labels both password fields, and only submits a valid matching password", async () => {
  let resolve!: (value: { valid: boolean; email: string }) => void;
  vi.spyOn(authApi, "verifyResetToken").mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const reset = vi
    .spyOn(authApi, "resetPassword")
    .mockResolvedValue({ message: "Password updated" });
  const token = "a".repeat(128);
  const { unmount } = mount(`/reset-password?token=${token}`);
  expect(
    await screen.findByText("Checking your secure reset link…"),
  ).toBeTruthy();
  expect(screen.queryByLabelText("New password")).toBeNull();
  await act(async () => resolve({ valid: true, email: "fan@example.com" }));
  const password = await screen.findByLabelText("New password");
  const confirm = screen.getByLabelText("Confirm password");
  fireEvent.change(password, { target: { value: "ValidPass1!" } });
  fireEvent.change(confirm, { target: { value: "different" } });
  expect(
    screen
      .getByRole("button", { name: "Reset password" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  expect(screen.getByRole("alert").textContent).toBe("Passwords do not match");
  fireEvent.change(confirm, { target: { value: "ValidPass1!" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  expect(
    await screen.findByRole("heading", { name: "Password updated." }),
  ).toBeTruthy();
  expect(reset).toHaveBeenCalledWith({
    token,
    password: "ValidPass1!",
    confirmPassword: "ValidPass1!",
  });
  unmount(); // also cancels the success redirect, without navigating a later page.
});

it("matches the server password-length bound before sending a reset request", async () => {
  vi.spyOn(authApi, "verifyResetToken").mockResolvedValue({
    valid: true,
    email: "fan@example.com",
  });
  const reset = vi
    .spyOn(authApi, "resetPassword")
    .mockResolvedValue({ message: "Password updated" });
  const { unmount } = mount(`/reset-password?token=${"c".repeat(128)}`);
  const password = await screen.findByLabelText("New password");
  const confirm = screen.getByLabelText("Confirm password");
  expect(password.getAttribute("maxlength")).toBe("128");
  expect(confirm.getAttribute("maxlength")).toBe("128");
  // Synthetic changes can bypass native maxlength; the submit guard must not.
  const tooLong = "A1!" + "a".repeat(126);
  fireEvent.change(password, { target: { value: tooLong } });
  fireEvent.change(confirm, { target: { value: tooLong } });
  const submit = screen.getByRole("button", { name: "Reset password" });
  expect(submit.getAttribute("aria-disabled")).toBe("true");
  fireEvent.submit(submit.closest("form")!);
  expect(reset).not.toHaveBeenCalled();
  const valid = tooLong.slice(0, 128);
  fireEvent.change(password, { target: { value: valid } });
  fireEvent.change(confirm, { target: { value: valid } });
  fireEvent.click(submit);
  await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
  unmount();
});

it("does not accept a reset verification response that is not valid", async () => {
  vi.spyOn(authApi, "verifyResetToken").mockResolvedValue({
    valid: false,
    email: "",
  });
  mount(`/reset-password?token=${"b".repeat(128)}`);
  expect(
    await screen.findByRole("heading", { name: "This link is unavailable" }),
  ).toBeTruthy();
  expect(screen.queryByLabelText("New password")).toBeNull();
});

it("uses native email validation before sending a recovery request", async () => {
  const forgot = vi.spyOn(authApi, "forgotPassword");
  mount("/forgot-password");
  await screen.findByRole("heading", { name: "Reset your password" });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "not-an-email" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(
    (screen.getByLabelText("Email address") as HTMLInputElement).validity.valid,
  ).toBe(false);
  expect(forgot).not.toHaveBeenCalled();
});
