import { Gavel, ShieldCheck, Users2, AlertCircle, MapPin, CalendarClock, Menu } from "lucide-react";
import { AuctionStatusBadge, ConnectionDot } from "./Badges";
import { useAuctionSocket, useLiveAuction, useAuth, useAuctionPermissions } from "@/features/auction/hooks/index.hook";
import { cn } from "@/utils/cn";
import { USER_ROLES } from "@/lib/constants/roles";
import { useState } from "react";
import { format } from "date-fns";

interface AuctionHeaderProps {
  /** Opens the mobile off-canvas sidebar. Omitted on layouts without one. */
  onMenuClick?: () => void;
}

// Shared header shell so the mobile menu trigger stays in the exact same
// spot across every render branch (skeleton / signed-out / live) — the
// button never jumps or disappears while the rest of the header loads in.
function HeaderShell({
  onMenuClick,
  children,
}: AuctionHeaderProps & { children: React.ReactNode }) {
  return (
    // z-30 is intentional: this sits *below* the mobile sidebar drawer (z-50)
    // and its scrim (z-40), so an open drawer always renders on top of the
    // header instead of the header bleeding through it. It's still above
    // ordinary page content, which is all it needs.
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-3 px-3 sm:h-20 sm:gap-4 sm:px-6">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {children}
      </div>
    </header>
  );
}

export function AuctionHeader({ onMenuClick }: AuctionHeaderProps) {
  const { auction, status } = useLiveAuction();
  const { connection, latencyMs } = useAuctionSocket();
  const { user, isAuthenticated, hasHydrated } = useAuth();
  const permissions = useAuctionPermissions();

  const [roleTooltipOpen, setRoleTooltipOpen] = useState(false);
  const [connTooltipOpen, setConnTooltipOpen] = useState(false);

  // Align with new normalized permissions + auth
  const userRole = user?.role ?? permissions.role;
  const isOrganizer = permissions.ownsAuction || 
                     permissions.ownsTournament || 
                     userRole === USER_ROLES.ORGANIZER || 
                     userRole === USER_ROLES.ADMIN;
  const roleLabel = isOrganizer ? "Organizer" : "Team Owner";
  const RoleIcon = isOrganizer ? ShieldCheck : Users2;

  // Rich tournament metadata from auction object (new store shape)
  const tournamentName = auction?.tournamentName || auction?.tournament?.name || "Live Auction";
  const auctionName = auction?.name || "";
  const season = auction?.season;
  const venue = auction?.venue;
  const auctionDate = auction?.auctionDate ? new Date(auction.auctionDate) : null;
  const formattedDate = auctionDate && !isNaN(auctionDate.getTime()) 
    ? format(auctionDate, "d MMM yyyy") 
    : null;

  // Loading skeleton — same h-16/h-20 shell as the live state so nothing
  // jumps in height once real content arrives.
  if (!hasHydrated || permissions.loading) {
    return (
      <HeaderShell onMenuClick={onMenuClick}>
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-800 sm:h-12 sm:w-12 sm:rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-800 sm:h-6 sm:w-80" />
            <div className="hidden h-4 w-64 animate-pulse rounded bg-slate-800 sm:block" />
          </div>
        </div>
      </HeaderShell>
    );
  }

  if (!isAuthenticated || !user || !auction) {
    return (
      <HeaderShell onMenuClick={onMenuClick}>
        <div className="flex min-w-0 items-center gap-3 text-slate-400">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 shadow-lg sm:h-12 sm:w-12 sm:rounded-2xl">
            <Gavel className="h-5 w-5 text-slate-950 sm:h-7 sm:w-7" />
          </div>
          <span className="truncate font-semibold">Auction Platform</span>
        </div>
      </HeaderShell>
    );
  }

  return (
    <HeaderShell onMenuClick={onMenuClick}>
      {/* LEFT: Rich Tournament Info — allowed to shrink & truncate so the
          right-hand controls never get pushed off-screen on narrow viewports. */}
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
        {/* Logo */}
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-xl shadow-amber-500/30 ring-1 ring-white/20 sm:h-12 sm:w-12 sm:rounded-2xl">
          <Gavel className="h-5 w-5 text-slate-950 sm:h-7 sm:w-7" />
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-xl">
              {tournamentName}
            </h1>

            {season && (
              <span className="hidden h-5 items-center rounded-full bg-amber-500/10 px-2.5 text-xs font-mono tracking-widest text-amber-400 ring-1 ring-amber-500/30 sm:inline-flex">
                SEASON {season}
              </span>
            )}

            <AuctionStatusBadge status={status} />
          </div>

          {/* Full meta line — venue/date only worth the space at sm+ */}
          <div className="mt-0.5 hidden flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-slate-400 sm:flex">
            <span className="truncate font-medium text-white/90">{auctionName}</span>

            {venue && (
              <span className="flex items-center gap-1.5 truncate">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                {venue}
              </span>
            )}

            {formattedDate && (
              <span className="flex items-center gap-1.5 truncate">
                <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
                {formattedDate}
              </span>
            )}
          </div>

          {/* Compact single-line fallback below sm, where there isn't room
              for the full meta row. */}
          {auctionName && (
            <p className="mt-0.5 truncate text-xs text-slate-400 sm:hidden">{auctionName}</p>
          )}
        </div>
      </div>

      {/* RIGHT: Controls & Indicators — fixed-size, never wraps; low-priority
          items drop off first as the viewport narrows. */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {/* Connection Status */}
        <div
          className="group relative hidden cursor-help items-center gap-2 rounded-2xl bg-white/5 px-3.5 py-2 text-xs text-slate-300 ring-1 ring-white/10 hover:ring-white/20 md:flex"
          onMouseEnter={() => setConnTooltipOpen(true)}
          onMouseLeave={() => setConnTooltipOpen(false)}
        >
          <ConnectionDot connection={connection} />
          <span className="capitalize font-medium">{connection}</span>
          {latencyMs !== undefined && (
            <span className="font-mono text-slate-500">· {latencyMs}ms</span>
          )}

          {connTooltipOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,90vw)] rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {connection === "connected" ? (
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-500/30" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-400" />
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-white">Live Auction Engine</p>
                  <p className="leading-snug text-slate-400">
                    Socket.IO primary • Automatic REST polling fallback
                  </p>
                  {latencyMs && <p className="text-emerald-400">Current latency: {latencyMs}ms</p>}
                </div>
              </div>
              <div className="absolute -top-1 right-6 h-2 w-2 rotate-45 border-l border-t border-white/10 bg-slate-900 sm:left-1/2 sm:right-auto sm:-translate-x-1/2" />
            </div>
          )}
        </div>

        {/* Real Role Indicator (aligned with new perms) — icon-only below sm */}
        <div
          className={cn(
            "group relative flex cursor-help items-center gap-2 rounded-2xl bg-white/5 px-2.5 py-2 text-sm font-medium ring-1 ring-white/10 transition-all hover:bg-white/10 hover:ring-white/20 sm:gap-2.5 sm:px-4",
            isOrganizer ? "text-amber-400" : "text-sky-400"
          )}
          onMouseEnter={() => setRoleTooltipOpen(true)}
          onMouseLeave={() => setRoleTooltipOpen(false)}
        >
          <div className="rounded-xl bg-white/10 p-1.5">
            <RoleIcon className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">{roleLabel}</span>

          {roleTooltipOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,90vw)] rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <RoleIcon className="h-5 w-5" />
                </div>
                <div className="space-y-1.5 text-sm">
                  <p className="font-semibold text-white">Signed in as <span className="font-mono">{userRole}</span></p>
                  <p className="text-slate-400 leading-snug">
                    {isOrganizer
                      ? "Full control over auction lifecycle, rules, rounds, and participants."
                      : "Team Owner: Place bids, manage franchise purse and squad."}
                  </p>
                  <div className="pt-2 text-[10px] uppercase tracking-[0.5px] text-slate-500 border-t border-white/10">
                    Role from normalized permissions • Server authoritative
                  </div>
                </div>
              </div>
              <div className="absolute -top-1 right-6 h-2 w-2 rotate-45 border-l border-t border-white/10 bg-slate-900 sm:left-1/2 sm:right-auto sm:-translate-x-1/2" />
            </div>
          )}
        </div>

        {/* Live Pulse */}
        {permissions.authenticated && (
          <div className="hidden items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30 sm:flex">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            LIVE
          </div>
        )}
      </div>
    </HeaderShell>
  );
}