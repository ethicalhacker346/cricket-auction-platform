import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { PageLoading } from "@/components/system/PageLoading";
import { authReturnTo } from "@/lib/utils/authRedirect";

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const role = useAuthStore((s) => s.user?.role);
  const location = useLocation();
  if (!hasHydrated) return <PageLoading />;
  if (isAuthenticated)
    return (
      <Navigate
        to={authReturnTo(
          location.state,
          role === "ADMIN" ? "/admin/dashboard" : "/dashboard",
        )}
        replace
      />
    );
  return <>{children}</>;
}
