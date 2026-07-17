import axios from "axios";
import type { ApiErrorShape } from "@/types/auth";

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorShape>(error)) {
    const data = error.response?.data;
    if (data?.errors?.length) {
      return data.errors.map((e) => e.message).join(" ");
    }
    if (data?.message) return data.message;
    if (error.code === "ECONNABORTED") return "Request timed out. Please try again.";
    if (!error.response) return "Can't reach the server. Check your connection.";
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
