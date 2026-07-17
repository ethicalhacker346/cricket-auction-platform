import { axiosClient } from "@/api/axiosClient";
import type {
  ApiEnvelope,
  AuthPayload,
  LoginPayload,
  RegisterPayload,
  User,
} from "@/types/auth";

// ─── Response Types ─────────────────────────────────────────────────────────
export interface ForgotPasswordResponse {
  message: string;
}

export interface VerifyResetTokenResponse {
  valid: boolean;
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
  confirmPassword: string;
}

export const authApi = {
  register: async (payload: RegisterPayload) => {
    const { confirmPassword: _confirmPassword, terms: _terms, ...body } = payload;
    const { data } = await axiosClient.post<ApiEnvelope<AuthPayload>>(
      "/auth/register",
      body
    );
    return data.data;
  },

  login: async (payload: LoginPayload) => {
    const { data } = await axiosClient.post<ApiEnvelope<AuthPayload>>("/auth/login", {
      email: payload.email,
      password: payload.password,
    });
    return data.data;
  },

  logout: async () => {
    const { data } = await axiosClient.post<ApiEnvelope<null>>("/auth/logout");
    return data;
  },

  me: async () => {
    const { data } = await axiosClient.get<ApiEnvelope<User>>("/auth/me");
    return data.data;
  },

  // ════════════════════════════════════════════════════════════════════════
  // PASSWORD RESET API — Fixed response unwrapping
  // ════════════════════════════════════════════════════════════════════════

  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const { data } = await axiosClient.post<ApiEnvelope<ForgotPasswordResponse>>(
      "/auth/forgot-password",
      { email }
    );
    // data = { success: true, data: { message: "..." } }
    return data.data;
  },

  verifyResetToken: async (token: string): Promise<VerifyResetTokenResponse> => {
    const { data } = await axiosClient.get<
      ApiEnvelope<VerifyResetTokenResponse>
    >("/auth/verify-reset-token", {
      params: { token },
    });
    return data.data;
  },

  resetPassword: async (
    payload: ResetPasswordPayload
  ): Promise<ForgotPasswordResponse> => {
    const { data } = await axiosClient.post<
      ApiEnvelope<ForgotPasswordResponse>
    >("/auth/reset-password", payload);
    return data.data;
  },
};