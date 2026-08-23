import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";

import { useAuthStore } from "@/store/authStore";
import { ProtectedRoute } from "@/routes/ProtectedRoutes";
import { PublicOnlyRoute } from "@/routes/PublicOnlyRoutes";
import OpeningLandingPage from "@/features/landing/OpeningLandingPage";

import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DashboardPage from "@/pages/DashBoardPage";
import NotFoundPage from "@/pages/NotFoundPage";

import TournamentPage from "@/pages/TournamentPage";
import CreateTournamentPage from "@/pages/CreateTournamentPage";
import EditTournamentPage from "@/pages/EditTournamentPage";
import { RegisterTeamPage } from "@/pages/RegisterTeamPage";
import { RegisterPlayerPage } from "@/pages/RegisterPlayerPage";
import { CreatePlayerPage } from "@/pages/CreatePlayerPage";
import { EditPlayerPage } from "@/pages/EditPlayerPage";
import { CreateFranchisePage } from "@/pages/CreateFranchisePage";
import { EditFranchisePage } from "@/pages/EditFranchisePage";
import { NotificationsPage } from "@/pages/NotificationsPage";

// Auction workspace
import { AuctionShell } from "@/features/auction/layout/AuctionShell";
import AuctionDashboardPage from "@/features/auction/pages/AuctionDashboardPage";
import CreateAuctionPage from "@/features/auction/pages/CreateAuctionPage";
import AuctionRoundsPage from "@/features/auction/pages/AuctionRoundsPage";
import RoundEditorPage from "@/features/auction/pages/RoundEditorPage";
import LiveAuctionPage from "@/features/auction/pages/LiveAuctionPage";
import FranchiseAuctionPage from "@/features/auction/pages/FranchiseAuctionPage";
import AuctionHistoryPage from "@/features/auction/pages/AuctionHistoryPage";
import AuctionAnalyticsPage from "@/features/auction/pages/AuctionAnalyticsPage";
import AuctionResultPage from "@/features/auction/pages/AuctionResultPage";
import LiveAuction3DPage from "@/features/auction/pages/LiveAuction3DPage";

import { AppShell } from "@/components/layout/AppShell";
import ConnectionStatus from "@/components/system/ConnectionStatus";

import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { AdminRoute } from "@/routes/AdminRoute";
import { AdminSectionPage } from "@/pages/AdminSectionPage";

import HelpShell from "@/components/help/HelpShell";
import HowAuctionsWorkPage from "@/pages/help/HowAuctionsWorkPage";
import AuctionGuidelinesPage from "@/pages/help/AuctionGuidelinesPage";
import BiddingRulesPage from "@/pages/help/BiddingRulesPage";
import SquadRulesPage from "@/pages/help/SquadRulesPage";
import HelpCenterPage from "./pages/help/HelpCenterPage";
import ContactSupportPage from "./pages/help/ContactSupportPage";
import FAQPage from "./pages/help/FAQPage";

import PrivacyPage from "@/pages/legal/PrivacyPage";
import TermsPage from "@/pages/legal/TermsPage";
import CreatorPage from "@/pages/creator/CreatorPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const OPENING_SEEN_KEY = "app-opening-seen";

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

/** Auth-only layout with no visual shell – just <Outlet /> */
function ProtectedOutlet() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}

export default function App() {
  // ────────────────────────────────────────────────
  // ONE-TIME SPLASH – survives any remount of <App>
  // ────────────────────────────────────────────────
  const [showOpening, setShowOpening] = useState(() => {
    try {
      return sessionStorage.getItem(OPENING_SEEN_KEY) !== "1";
    } catch {
      // private mode / SSR – fall back to showing once
      return true;
    }
  });

  const handleOpeningComplete = () => {
    try {
      sessionStorage.setItem(OPENING_SEEN_KEY, "1");
    } catch {
      // ignore
    }
    setShowOpening(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/*
          Splash lives completely outside <Routes>.
          Once dismissed it is unmounted forever for this tab session.
          No route change can bring it back.
        */}
        <AnimatePresence mode="wait">
          {showOpening && (
            <OpeningLandingPage
              duration={5200}
              onComplete={handleOpeningComplete}
            />
          )}
        </AnimatePresence>
        
        {/*{!showOpening && <ConnectionStatus />}*/}

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "0.75rem",
              background: "#0f172a",
              color: "#fff",
              fontSize: "0.875rem",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#fff" },
            },
          }}
        />

        <Routes>
          {/* ═══════════════ PUBLIC ═══════════════ */}
          <Route path="/" element={<RootRedirect />} />

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

          {/* ═══════════════ APPSHELL (only these two) ═══════════════ */}
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

          {/* ═══════════════ FULL-PAGE PROTECTED ═══════════════ */}
          <Route element={<ProtectedOutlet />}>
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
            <Route path="/admin/tournaments" element={<AdminRoute><AdminSectionPage kind="tournaments" /></AdminRoute>} />
+           <Route path="/admin/auctions" element={<AdminRoute><AdminSectionPage kind="auctions" /></AdminRoute>} />
+           <Route path="/admin/players" element={<AdminRoute><AdminSectionPage kind="players" /></AdminRoute>} />
+           <Route path="/admin/franchises" element={<AdminRoute><AdminSectionPage kind="franchises" /></AdminRoute>} />
+           <Route path="/admin/users" element={<AdminRoute><AdminSectionPage kind="users" /></AdminRoute>} />
+           <Route path="/admin/audit-logs" element={<AdminRoute><AdminSectionPage kind="audit" /></AdminRoute>} />
+           <Route path="/admin/system-health" element={<AdminRoute><AdminSectionPage kind="systemHealth" /></AdminRoute>} />
+           <Route path="/admin/settings" element={<AdminRoute><AdminSectionPage kind="settings" /></AdminRoute>} />
+           <Route path="/admin/attention" element={<AdminRoute><AdminSectionPage kind="attention" /></AdminRoute>} />
+           <Route path="/admin/data-quality" element={<AdminRoute><AdminSectionPage kind="dataQuality" /></AdminRoute>} />
+           <Route path="/admin/analytics" element={<AdminRoute><AdminSectionPage kind="analytics" /></AdminRoute>} />
+           <Route path="/admin/search" element={<AdminRoute><AdminSectionPage kind="search" /></AdminRoute>} />

            

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


            <Route  element={<HelpShell />}>
              <Route path="/help" element={<HelpCenterPage />} />
              <Route path="/help/auctions" element={<HowAuctionsWorkPage />} />
              {/*<Route path="/help/auctions" element={<HowAuctionsWorkPage />} />*/}
              <Route path="/help/guidelines" element={<AuctionGuidelinesPage />} />
              <Route path="/help/bidding" element={<BiddingRulesPage />} />
              <Route path="/help/squads" element={<SquadRulesPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/contact" element={<ContactSupportPage />} />
            </Route>
          </Route>

          {/* ═══════════════ AUCTION WORKSPACE ═══════════════ */}
          <Route
            path="/tournaments/:tournamentId/auction/:auctionId"
            element={
              <ProtectedRoute>
                <AuctionShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AuctionDashboardPage />} />
            <Route path="configuration" element={<CreateAuctionPage />} />
            <Route path="rounds" element={<AuctionRoundsPage />} />
            <Route path="rounds/:roundId" element={<RoundEditorPage />} />
            <Route path="live" element={<LiveAuctionPage />} />
            <Route path="live/3d" element={<LiveAuction3DPage />} />
            <Route path="team" element={<FranchiseAuctionPage />} />
            <Route path="history" element={<AuctionHistoryPage />} />
            <Route path="analytics" element={<AuctionAnalyticsPage />} />
            <Route path="results" element={<AuctionResultPage />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ═══════════════ FALLBACK ═══════════════ */}
          <Route path="*" element={<NotFoundPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/creator" element={<CreatorPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
