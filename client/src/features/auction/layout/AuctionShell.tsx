import {Link, NavLink, Outlet } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Gavel,
  History,
  LayoutDashboard,
  ListOrdered,
  Settings2,
  Trophy,
  Users,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NAV_ITEMS } from "@/features/auction/constants/index.constants";
import { AuctionHeader } from "@/features/auction/components/AuctionHeader";
import { cn } from "@/utils/cn";
import { useAuctionContext } from "../hooks/useAuctionContext";
import { resolveAuctionRoute } from "../routes/auction.navigation";
import { AuctionRoutes } from "../routes/auction.routes";
// ============================================================================
// NEW: Import the socket bootstrap and the sound engine
// ============================================================================
import {
  useAuth,
  useAuctionPermissions,
  useAuctionSocket,
} from "@/features/auction/hooks/index.hook";
import { AuctionSoundEngine } from "@/features/auction/audio/AuctionSoundEngine";
import { USER_ROLES } from "@/lib/constants/roles";

type IconName = (typeof NAV_ITEMS)[number]["icon"];

const ICONS: Record<IconName, React.ElementType> = {
  LayoutDashboard,
  Settings2,
  ListOrdered,
  Gavel,
  Users,
  History,
  BarChart3,
  Trophy,
};

const RESTRICTED_SEGMENTS = new Set(["configuration", "rounds", "team"]);
const SIDEBAR_COLLAPSE_KEY = "gullybid-sidebar-collapsed";

function useVisibleNavItems(auctionId: string) {
  const { user } = useAuth();
  const permissions = useAuctionPermissions(auctionId);

  const userRole = user?.role ?? permissions.role;
  const isOrganizer =
    !permissions.loading &&
    (permissions.ownsAuction ||
      permissions.ownsTournament ||
      userRole === USER_ROLES.ORGANIZER ||
      userRole === USER_ROLES.ADMIN);
  const isFranchiseOwner = user?.role === "FRANCHISE_OWNER";

  const canSeeConfiguration = isOrganizer;
  const canSeeRounds = isOrganizer;
  const canSeeTeam = !permissions.loading && isFranchiseOwner;

  return useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (!RESTRICTED_SEGMENTS.has(item.segment)) return true;
        if (item.segment === "configuration") return canSeeConfiguration;
        if (item.segment === "rounds") return canSeeRounds;
        if (item.segment === "team") return canSeeTeam;
        return true;
      }),
    [canSeeConfiguration, canSeeRounds, canSeeTeam]
  );
}

export function AuctionShell() {
  const { tournamentId, auctionId } = useAuctionContext();

  // ========================================================================
  // NEW: Eager socket bootstrap at the layout boundary.
  //
  // Previously, this only happened inside LiveAuctionPage via useLiveAuction.
  // Now the connection starts as soon as the user enters ANY auction route
  // (dashboard, live, team, history, analytics, results).
  //
  // The store's bootstrap() is idempotent — child pages calling
  // useAuctionSocket() again will safely no-op. But by hoisting it here,
  // we guarantee the session is alive before any child asks for data.
  // ========================================================================
  const {
    isConnected,
    latencyMs,
    shouldShowReconnect,
  } = useAuctionSocket({
    tournamentId,
    auctionId,
  });

  const visibleNavItems = useVisibleNavItems(auctionId);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden border-r border-white/10 bg-slate-950/95 backdrop-blur-2xl transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 lg:transition-[width] lg:duration-300 lg:ease-out",
          collapsed ? "lg:w-20" : "lg:w-72"
        )}
      >
        {/* Brand row */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 px-5 py-4",
            collapsed && "lg:justify-center lg:px-0"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500">
            <Gavel className="h-4 w-4 text-slate-950" />
          </div>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-bold tracking-tight text-white",
              collapsed && "lg:hidden"
            )}
          >
            AuctionRoom
          </span>

          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop toggle row */}
        <div
          className={cn(
            "hidden shrink-0 px-3 pb-2 pt-1 lg:flex",
            collapsed ? "justify-center" : "justify-end"
          )}
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-lg p-1.5 text-slate-400 ring-1 ring-white/5 transition hover:bg-white/5 hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        {/* Universal tournament navigation */}
<div
  className={cn(
    "shrink-0 px-2 pb-3",
    collapsed && "lg:px-2"
  )}
>
  <Link
    to={AuctionRoutes.tournament(tournamentId)}
    onClick={() => setMobileOpen(false)}
    className={cn(
      "group relative flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 hover:text-amber-200",
      collapsed && "lg:justify-center lg:px-0"
    )}
    aria-label="Back to Tournament"
    title={collapsed ? "Back to Tournament" : undefined}
  >
    <ArrowLeft className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />

    <span className={cn("truncate", collapsed && "lg:hidden")}>
      Back to Tournament
    </span>

    {collapsed && (
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-xl transition-opacity lg:group-hover:block lg:group-hover:opacity-100">
        Back to Tournament
      </span>
    )}
  </Link>
</div>

        {/* Nav */}
        <nav className={cn("min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-2", collapsed && "lg:px-2")}>
          {visibleNavItems.map((item) => {
            const Icon = ICONS[item.icon];
            const href = resolveAuctionRoute(item.segment, tournamentId, auctionId);

            return (
              <NavLink
                key={item.segment}
                to={href}
                end={item.segment === "dashboard"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    collapsed && "lg:justify-center lg:px-0",
                    isActive
                      ? "bg-gradient-to-r from-amber-400/15 to-transparent text-amber-300 ring-1 ring-amber-400/20"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>

                {collapsed && (
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-xl transition-opacity lg:group-hover:block lg:group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer panel */}
        <div className={cn("shrink-0 px-5 py-4", collapsed && "lg:hidden")}>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-slate-500">
            State-driven live auction engine.Socket.IO = primary realtime transport ,REST snapshot = reconciliation/fallback.
          </div>
        </div>
      </aside>

      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main column */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AuctionHeader onMenuClick={() => setMobileOpen(true)} />

        {/* =================================================================
            NEW: AuctionSoundEngine
            Mounted once at the layout level. Renders null. Listens to the
            global Zustand store + EventBus. Survives tab switches.
            ================================================================= */}
        <AuctionSoundEngine />

        {/* =================================================================
            NEW: Connection status strip (optional but recommended)
            If the user is on the Dashboard tab and the socket drops, they
            would otherwise have no idea. This gives universal feedback.
            ================================================================= */}
        {shouldShowReconnect && (
          <div className="bg-amber-600 text-xs font-bold text-center py-1 animate-pulse">
            Reconnecting to auction room… {latencyMs}ms
          </div>
        )}

        <main className=" min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}