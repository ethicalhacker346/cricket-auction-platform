import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import CreateTournamentPage from "./pages/CreateTournamentPage";
import EditTournamentPage from "./pages/EditTournamentPage";
import { RegisterTeamPage } from "@/pages/RegisterTeamPage";
import { RegisterPlayerPage } from "@/pages/RegisterPlayerPage";
import { CreatePlayerPage } from "./pages/CreatePlayerPage";
import { EditPlayerPage } from "./pages/EditPlayerPage";
import { CreateFranchisePage } from "./pages/CreateFranchisePage";
import { EditFranchisePage } from "./pages/EditFranchisePage";

// === AUCTION IMPORTS ===
import { AuctionShell } from "./features/auction/layout/AuctionShell";
import AuctionDashboardPage from "./features/auction/pages/AuctionDashboardPage";
import CreateAuctionPage from "./features/auction/pages/CreateAuctionPage";
import AuctionRoundsPage from "./features/auction/pages/AuctionRoundsPage";
import RoundEditorPage from "./features/auction/pages/RoundEditorPage";
import LiveAuctionPage from "./features/auction/pages/LiveAuctionPage";
import FranchiseAuctionPage from "./features/auction/pages/FranchiseAuctionPage";
import AuctionHistoryPage from "./features/auction/pages/AuctionHistoryPage";
import AuctionAnalyticsPage from "./features/auction/pages/AuctionAnalyticsPage";
import AuctionResultPage from "./features/auction/pages/AuctionResultPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  const [showOpening, setShowOpening] = useState(true);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AnimatePresence mode="wait">
          {showOpening && (
            <OpeningLandingPage
              duration={5200}
              onComplete={() => setShowOpening(false)}
            />
          )}
        </AnimatePresence>
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
            success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
          }}
        />

        <Routes>
          {/* Public Routes */}
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

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Tournament Routes */}
          <Route
            path="/tournaments/create"
            element={
              <ProtectedRoute>
                <CreateTournamentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tournaments/:id/edit"
            element={
              <ProtectedRoute>
                <EditTournamentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tournaments/:tournamentId/register-franchise"
            element={
              <ProtectedRoute>
                <RegisterTeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tournaments/:tournamentId/register-player"
            element={
              <ProtectedRoute>
                <RegisterPlayerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tournaments/:id"
            element={
              <ProtectedRoute>
                <TournamentPage />
              </ProtectedRoute>
            }
          />

          {/* Player & Franchise Routes */}
          <Route
            path="/create-player"
            element={
              <ProtectedRoute>
                <CreatePlayerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/players/:id/edit"
            element={
              <ProtectedRoute>
                <EditPlayerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-franchise"
            element={
              <ProtectedRoute>
                <CreateFranchisePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/franchises/:id/edit"
            element={
              <ProtectedRoute>
                <EditFranchisePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tournaments/:tournamentId/auction/create"
            element={
              <ProtectedRoute>
                <CreateAuctionPage />
              </ProtectedRoute>
            }
          />

          {/* === AUCTION ROUTES (Nested under /auctions) === */}
          <Route
            path="/tournaments/:tournamentId/auction/:auctionId"
            element={
              <ProtectedRoute>
                <AuctionShell />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
               <Navigate
                 to="dashboard"
                 replace
               />
              } 
            />

            <Route
              path="dashboard"
              element={<AuctionDashboardPage/>}
            />
            <Route path="configuration" element={<CreateAuctionPage />} />
            <Route path="rounds" element={<AuctionRoundsPage />} />
            <Route path="rounds/:roundId" element={<RoundEditorPage />} />
            <Route path="live" element={<LiveAuctionPage />} />
            <Route path="team" element={<FranchiseAuctionPage />} />
            <Route path="history" element={<AuctionHistoryPage />} />
            <Route path="analytics" element={<AuctionAnalyticsPage />} />
            <Route path="results" element={<AuctionResultPage />} />
            <Route path="*" element={<Navigate to="../dashboard" replace />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}