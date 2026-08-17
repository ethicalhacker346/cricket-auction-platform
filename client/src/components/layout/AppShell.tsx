import { Outlet } from "react-router-dom";
import { Header } from "@/components/header/Header";

/**
 * Route-level layout. Mount this on a parent route whose children are
 * the dashboard and tournament pages, e.g.:
 *
 *   <Route element={<AppShell />}>
 *     <Route path="/dashboard" element={<DashboardPage />} />
 *     <Route path="/tournaments" element={<TournamentPage />} />
 *   </Route>
 *
 * A single <Outlet /> renders whichever child route matched.
 */
export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-2 py-0 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}