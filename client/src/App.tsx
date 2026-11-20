import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/store/authStore";
import { ProtectedRoute } from "@/routes/ProtectedRoutes";
import { PublicOnlyRoute } from "@/routes/PublicOnlyRoutes";
import { AdminRoute } from "@/routes/AdminRoute";
import { PageLoading } from "@/components/system/PageLoading";
import { RouteErrorBoundary } from "@/components/system/RouteErrorBoundary";
import { RouteEffects } from "@/components/system/RouteEffects";
import LandingPage from "@/features/landing/LandingPage";
import NotFoundPage from "@/pages/NotFoundPage";

// Keep the public entry independent of auction engines, PDF exporters, charts,
// admin tools, and WebGL. Each page is requested only when its route opens.
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/DashBoardPage"));
const TournamentPage = lazy(() => import("@/pages/TournamentPage"));
const CreateTournamentPage = lazy(() => import("@/pages/CreateTournamentPage"));
const EditTournamentPage = lazy(() => import("@/pages/EditTournamentPage"));
const RegisterTeamPage = lazy(() =>
  import("@/pages/RegisterTeamPage").then((m) => ({
    default: m.RegisterTeamPage,
  })),
);
const RegisterPlayerPage = lazy(() =>
  import("@/pages/RegisterPlayerPage").then((m) => ({
    default: m.RegisterPlayerPage,
  })),
);
const CreatePlayerPage = lazy(() =>
  import("@/pages/CreatePlayerPage").then((m) => ({
    default: m.CreatePlayerPage,
  })),
);
const EditPlayerPage = lazy(() =>
  import("@/pages/EditPlayerPage").then((m) => ({ default: m.EditPlayerPage })),
);
const CreateFranchisePage = lazy(() =>
  import("@/pages/CreateFranchisePage").then((m) => ({
    default: m.CreateFranchisePage,
  })),
);
const EditFranchisePage = lazy(() =>
  import("@/pages/EditFranchisePage").then((m) => ({
    default: m.EditFranchisePage,
  })),
);
const NotificationsPage = lazy(() =>
  import("@/pages/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const AppShell = lazy(() =>
  import("@/components/layout/AppShell").then((m) => ({ default: m.AppShell })),
);
const AdminDashboardPage = lazy(() =>
  import("@/pages/AdminDashboardPage").then((m) => ({
    default: m.AdminDashboardPage,
  })),
);
const AdminSectionPage = lazy(() =>
  import("@/pages/AdminSectionPage").then((m) => ({
    default: m.AdminSectionPage,
  })),
);
const AuctionShell = lazy(() =>
  import("@/features/auction/layout/AuctionShell").then((m) => ({
    default: m.AuctionShell,
  })),
);
const AuctionAccessRoute = lazy(() =>
  import("@/features/auction/routes/AuctionAccessRoute").then((m) => ({
    default: m.AuctionAccessRoute,
  })),
);
const AuctionDashboardPage = lazy(
  () => import("@/features/auction/pages/AuctionDashboardPage"),
);
const CreateAuctionPage = lazy(
  () => import("@/features/auction/pages/CreateAuctionPage"),
);
const AuctionRoundsPage = lazy(
  () => import("@/features/auction/pages/AuctionRoundsPage"),
);
const RoundEditorPage = lazy(
  () => import("@/features/auction/pages/RoundEditorPage"),
);
const LiveAuctionPage = lazy(
  () => import("@/features/auction/pages/LiveAuctionPage"),
);
const FranchiseAuctionPage = lazy(
  () => import("@/features/auction/pages/FranchiseAuctionPage"),
);
const AuctionHistoryPage = lazy(
  () => import("@/features/auction/pages/AuctionHistoryPage"),
);
const AuctionAnalyticsPage = lazy(
  () => import("@/features/auction/pages/AuctionAnalyticsPage"),
);
const AuctionResultPage = lazy(
  () => import("@/features/auction/pages/AuctionResultPage"),
);
const LiveAuction3DPage = lazy(
  () => import("@/features/auction/pages/LiveAuction3DPage"),
);
const HelpShell = lazy(() => import("@/components/help/HelpShell"));
const HowAuctionsWorkPage = lazy(
  () => import("@/pages/help/HowAuctionsWorkPage"),
);
const AuctionGuidelinesPage = lazy(
  () => import("@/pages/help/AuctionGuidelinesPage"),
);
const BiddingRulesPage = lazy(() => import("@/pages/help/BiddingRulesPage"));
const SquadRulesPage = lazy(() => import("@/pages/help/SquadRulesPage"));
const HelpCenterPage = lazy(() => import("@/pages/help/HelpCenterPage"));
const ContactSupportPage = lazy(
  () => import("@/pages/help/ContactSupportPage"),
);
const FAQPage = lazy(() => import("@/pages/help/FAQPage"));
const PrivacyPage = lazy(() => import("@/pages/legal/PrivacyPage"));
const TermsPage = lazy(() => import("@/pages/legal/TermsPage"));
const CreatorPage = lazy(() => import("@/pages/creator/CreatorPage"));

function RootPage() {
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hasHydrated);
  if (!hydrated) return <PageLoading />;
  return authenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

function ProtectedOutlet() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}

export function ApplicationRoutes() {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicOnlyRoute>
                <ResetPasswordPage />
              </PublicOnlyRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/tournaments/:id" element={<TournamentPage />} />
          </Route>
          <Route element={<ProtectedOutlet />}>
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="tournaments" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/auctions"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="auctions" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/players"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="players" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/franchises"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="franchises" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="users" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="audit" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/system-health"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="systemHealth" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="settings" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/attention"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="attention" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/data-quality"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="dataQuality" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="analytics" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/search"
              element={
                <AdminRoute>
                  <AdminSectionPage kind="search" />
                </AdminRoute>
              }
            />
            <Route
              path="/tournaments/create"
              element={<CreateTournamentPage />}
            />
            <Route
              path="/tournaments/:id/edit"
              element={<EditTournamentPage />}
            />
            <Route
              path="/tournaments/:tournamentId/register-franchise"
              element={<RegisterTeamPage />}
            />
            <Route
              path="/tournaments/:tournamentId/register-player"
              element={<RegisterPlayerPage />}
            />
            <Route
              path="/tournaments/:tournamentId/auction/create"
              element={<CreateAuctionPage />}
            />
            <Route path="/create-player" element={<CreatePlayerPage />} />
            <Route path="/players/:id/edit" element={<EditPlayerPage />} />
            <Route path="/create-franchise" element={<CreateFranchisePage />} />
            <Route
              path="/franchises/:id/edit"
              element={<EditFranchisePage />}
            />
          </Route>

          {/* Rules, help, and contact are genuinely public, not login traps. */}
          <Route element={<HelpShell />}>
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/help/auctions" element={<HowAuctionsWorkPage />} />
            <Route
              path="/help/guidelines"
              element={<AuctionGuidelinesPage />}
            />
            <Route path="/help/bidding" element={<BiddingRulesPage />} />
            <Route path="/help/squads" element={<SquadRulesPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/contact" element={<ContactSupportPage />} />
          </Route>
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/creator" element={<CreatorPage />} />

          <Route
            path="/tournaments/:tournamentId/auction/:auctionId"
            element={<AuctionShell />}
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AuctionDashboardPage />} />
            <Route
              path="configuration"
              element={
                <AuctionAccessRoute access="manage">
                  <CreateAuctionPage />
                </AuctionAccessRoute>
              }
            />
            <Route
              path="rounds"
              element={
                <AuctionAccessRoute access="manage">
                  <AuctionRoundsPage />
                </AuctionAccessRoute>
              }
            />
            <Route
              path="rounds/:roundId"
              element={
                <AuctionAccessRoute access="manage">
                  <RoundEditorPage />
                </AuctionAccessRoute>
              }
            />
            <Route path="live" element={<LiveAuctionPage />} />
            <Route path="live/3d" element={<LiveAuction3DPage />} />
            <Route
              path="team"
              element={
                <AuctionAccessRoute access="team">
                  <FranchiseAuctionPage />
                </AuctionAccessRoute>
              }
            />
            <Route path="history" element={<AuctionHistoryPage />} />
            <Route path="analytics" element={<AuctionAnalyticsPage />} />
            <Route path="results" element={<AuctionResultPage />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <RouteEffects />
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: ".75rem",
            background: "#0f172a",
            color: "#fff",
            fontSize: ".875rem",
          },
          success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
        }}
      />
      <ApplicationRoutes />
    </BrowserRouter>
  );
}
