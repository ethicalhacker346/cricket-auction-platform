import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthPayload } from "@/types/auth";

const payload: AuthPayload = {
  user: {
    _id: "local-user",
    name: "Local Fan",
    email: "fan@example.com",
    role: "PLAYER",
    isActive: true,
    createdAt: "2026-11-18",
    updatedAt: "2026-11-18",
  },
  accessToken: "test-access",
  refreshToken: "test-refresh",
};
afterEach(() => vi.unstubAllGlobals());

describe("authentication storage resilience", () => {
  it("finishes hydration and permits an in-memory session when storage is blocked", async () => {
    vi.resetModules();
    const fail = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
    vi.stubGlobal("localStorage", {
      getItem: fail,
      setItem: fail,
      removeItem: fail,
      clear: () => {},
    });
    const { useAuthStore } = await import("./authStore");
    expect(useAuthStore.getState().hasHydrated).toBe(true);
    expect(() => useAuthStore.getState().setAuth(payload)).not.toThrow();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
  it("does not trap the public entry behind hydration after corrupt persisted JSON", async () => {
    vi.resetModules();
    localStorage.setItem("gullybid-auth", "{broken json");
    const { useAuthStore } = await import("./authStore");
    await Promise.resolve();
    expect(useAuthStore.getState().hasHydrated).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
  it("handles quota errors on writes without turning a successful sign-in into a failed mutation", async () => {
    vi.resetModules();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota", "QuotaExceededError");
    });
    const { useAuthStore } = await import("./authStore");
    expect(() => useAuthStore.getState().setAuth(payload)).not.toThrow();
    expect(useAuthStore.getState().user?.name).toBe("Local Fan");
  });
});
