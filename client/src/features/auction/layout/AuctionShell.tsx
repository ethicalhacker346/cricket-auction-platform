import { NavLink, Outlet } from "react-router-dom";
import {
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
import { useAuth, useAuctionPermissions } from "@/features/auction/hooks/index.hook";
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

// Nav segments whose visibility is gated by role/permissions rather than
// always shown. Anything not listed here is visible to every authenticated
// user (dashboard, live, history, analytics, results).
const RESTRICTED_SEGMENTS = new Set(["configuration", "rounds", "team"]);

const SIDEBAR_COLLAPSE_KEY = "gullybid-sidebar-collapsed";

/**
 * Derives which nav segments are visible for the current viewer.
 *
 * Nav visibility asks "what kind of user is this?" — a different question
 * from "can this user mutate X right now?". Configuration/Rounds used to be
 * gated on canUpdateRules/canManageRounds, but the backend also flips those
 * false once the auction leaves draft/scheduled (rules & rounds become
 * read-only once live) — so an organizer's own Configuration and Rounds
 * links would vanish from their sidebar the moment their auction went live.
 * Gating on organizer identity instead (ownership or role) keeps the nav
 * item visible for the whole lifecycle; the Configuration/Rounds pages
 * themselves still use canUpdateRules/canManageRounds to decide what's
 * editable once you're there.
 *
 *   - Organizers/Admins: everything except Team Console.
 *   - Franchise Owners: Configuration + Rounds hidden, Team Console shown.
 *   - Everyone else (players, unassigned viewers): Configuration, Rounds,
 *     and Team Console all hidden.
 *
 * While permissions are still loading, restricted segments default to
 * hidden — never flash a privileged section before we know it's allowed.
 */
function useVisibleNavItems(auctionId: string) {
  const { user } = useAuth();
  const permissions = useAuctionPermissions(auctionId);

  // Same identity check AuctionHeader uses for its role pill — kept in sync
  // deliberately, so "who counts as an organizer" never drifts between the
  // header and the sidebar.
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
  const visibleNavItems = useVisibleNavItems(auctionId);

  // Mobile off-canvas drawer — slides over content, closes on navigate/escape.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Desktop persistent collapse — sidebar takes up real layout space, so
  // collapsing it actually gives the content area its width back instead of
  // just hiding it behind a translate. Remembered across visits.
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
      // Storage can be unavailable (private mode, quota) — collapse state
      // simply won't persist, which is harmless.
    }
  }, [collapsed]);

  // Lock body scroll + support Escape while the mobile drawer is open.
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
      {/* Sidebar
          - Below `lg`: fixed off-canvas drawer, slides in/out, sits above content.
          - At `lg`+: sticky-in-flow (not `fixed`), so it never scrolls out of
            view with the page, but still reserves its own layout width —
            which is what lets the collapse toggle actually reflow content. */}
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

          {/* Mobile: close drawer (desktop rail has its own toggle row below) */}
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop toggle row — lives inside the sidebar itself, so the
            control to reopen a collapsed rail is never off somewhere else.
            Expanded: sits top-right, tucks the sidebar into an icon rail.
            Collapsed: centered, expands it back out. */}
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

        {/* Nav — the only part allowed to scroll internally, and only if the
            item list ever outgrows the viewport. The sidebar shell itself
            never scrolls with the page. Collapsed: icons only, centered,
            with a hover tooltip standing in for the hidden label. */}
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

                {/* Hover tooltip — only meaningful (and only mounted) once
                    the rail is collapsed; harmless on mobile since it stays
                    display:none there regardless. */}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-xl transition-opacity lg:group-hover:block lg:group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer panel — hidden on the collapsed rail since the copy
            doesn't fit; reappears once expanded. Normal flow (not
            absolutely positioned), so it can never overlap nav items. */}
        <div className={cn("shrink-0 px-5 py-4", collapsed && "lg:hidden")}>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-slate-500">
            State-driven live auction engine. No polling, no refetching — every screen reacts to the same real-time snapshot.
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

      {/* Main column — the header now owns the mobile menu trigger itself
          (see AuctionHeader's onMenuClick), so there's a single sticky bar
          instead of a separate hamburger strip stacked above it. */}
      <div className="flex min-h-screen flex-1 flex-col">
        <AuctionHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}