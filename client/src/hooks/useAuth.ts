import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "@/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/lib/utils/errorMessage";
import type { LoginPayload, RegisterPayload } from "@/types/auth";
import { ROLE_LABELS } from "@/lib/constants/roles";

// ─── Existing Hooks (unchanged) ───────────────────────────────────────────
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (data) => {
      setAuth(data);
      toast.success(`Welcome back, ${data.user.name.split(" ")[0]}!`);
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: (data) => {
      setAuth(data);
      toast.success(
        `Account created! You're in as a ${ROLE_LABELS[data.user.role]}.`
      );
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      toast.success("You've been signed out.");
      navigate("/login", { replace: true });
    },
  });
}

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const user = await authApi.me();
        updateUser(user);
        return user;
      } catch (error) {
        clearAuth();
        throw error;
      }
    },
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

// ════════════════════════════════════════════════════════════════════════
// PASSWORD RESET HOOKS — Production Hardened
// ════════════════════════════════════════════════════════════════════════

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: (data) => {
      // data is { message: string } — unwrapped correctly by authApi
      toast.success(data.message);
    },
    onError: (error: any) => {
      // Extract message from axios error response or fallback
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.data?.message ||
        error?.message ||
        "Failed to send reset link. Please try again.";
      toast.error(message);
    },
  });
}

export function useVerifyResetToken(token: string | null) {
  return useQuery({
    queryKey: ["auth", "verify-reset-token", token],
    queryFn: () => {
      if (!token || token.length !== 128) {
        throw new Error("Invalid reset token format");
      }
      return authApi.verifyResetToken(token);
    },
    enabled: !!token && token.length === 128,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useResetPassword() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: { token: string; password: string; confirmPassword: string }) =>
      authApi.resetPassword(payload),
    onSuccess: (data) => {
      toast.success(data.message);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}