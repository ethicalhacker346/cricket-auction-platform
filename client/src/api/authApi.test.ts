import { describe, expect, it, vi } from "vitest";
import { authApi } from "./authApi";
import { axiosClient } from "./axiosClient";

describe("password recovery response contracts", () => {
  it("reads reset-password's top-level message, not a nonexistent nested payload", async () => {
    const message =
      "Password reset successful. Please sign in with your new password.";
    const post = vi.spyOn(axiosClient, "post").mockResolvedValue({
      data: { success: true, message },
    });
    const payload = {
      token: "a".repeat(128),
      password: "NewPassword1!",
      confirmPassword: "NewPassword1!",
    };
    expect(await authApi.resetPassword(payload)).toEqual({ message });
    expect(post).toHaveBeenCalledWith("/auth/reset-password", payload);
  });

  it("still unwraps forgot-password's nested message without confusing the two endpoint envelopes", async () => {
    const message =
      "If an account exists with this email, a reset link has been sent.";
    vi.spyOn(axiosClient, "post").mockResolvedValue({
      data: { success: true, data: { message } },
    });
    expect(await authApi.forgotPassword("fan@example.test")).toEqual({
      message,
    });
  });
});
