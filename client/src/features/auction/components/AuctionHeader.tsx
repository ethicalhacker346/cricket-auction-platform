import { Gavel, ShieldCheck, Users2, Clock, Users, AlertCircle, MapPin, CalendarClock } from "lucide-react";
import { AuctionStatusBadge, ConnectionDot } from "./Badges";
import { useAuctionSocket, useLiveAuction, useAuth, useAuctionPermissions } from "@/features/auction/hooks/index.hook";
import { cn } from "@/utils/cn";
import { USER_ROLES } from "@/lib/constants/roles";
import { useState } from "react";
import { format } from "date-fns";

export function AuctionHeader() {
  const { auction, status } = useLiveAuction();
  const { connection, latencyMs } = useAuctionSocket();
  const { user, isAuthenticated, hasHydrated } = useAuth();
  const permissions = useAuctionPermissions();

  const [roleTooltipOpen, setRoleTooltipOpen] = useState(false);
  const [connTooltipOpen, setConnTooltipOpen] = useState(false);

  // Real role from auth
  const userRole = user?.role;
  const isOrganizer = userRole === USER_ROLES.ORGANIZER || userRole === USER_ROLES.ADMIN;
  const roleLabel = isOrganizer ? "Organizer" : "Team Owner";
  const RoleIcon = isOrganizer ? ShieldCheck : Users2;

  // Rich tournament metadata from auction object
  const tournamentName = auction?.tournamentName || "Live Auction";
  const auctionName = auction?.name || "";
  const season = auction?.season;
  const venue = auction?.venue;
  const auctionDate = auction?.auctionDate ? new Date(auction.auctionDate) : null;
  const formattedDate = auctionDate && !isNaN(auctionDate.getTime()) 
    ? format(auctionDate, "d MMM yyyy") 
    : null;

  // Loading skeleton
  if (!hasHydrated) {
    return (
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-2xl">
        <div className="flex h-20 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-800" />
            <div className="space-y-2">
              <div className="h-6 w-80 animate-pulse rounded bg-slate-800" />
              <div className="h-4 w-64 animate-pulse rounded bg-slate-800" />
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (!isAuthenticated || !user || !auction) {
    return (
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-2xl">
        <div className="flex h-20 items-center px-6 text-slate-400">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 shadow-lg">
              <Gavel className="h-7 w-7 text-slate-950" />
            </div>
            <span className="font-semibold">Auction Platform</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-6 px-4 py-4 sm:px-6">
        {/* LEFT: Rich Tournament Info (Inspired by TournamentHero) */}
        <div className="flex min-w-0 items-center gap-5">
          {/* Logo */}
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-xl shadow-amber-500/30 ring-1 ring-white/20">
            <Gavel className="h-7 w-7 text-slate-950" />
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="truncate text-xl font-semibold tracking-tight text-white">
                {tournamentName}
              </h1>

              {season && (
                <span className="inline-flex h-5 items-center rounded-full bg-amber-500/10 px-2.5 text-xs font-mono tracking-widest text-amber-400 ring-1 ring-amber-500/30">
                  SEASON {season}
                </span>
              )}

              <AuctionStatusBadge status={status} className="ml-auto sm:ml-0" />
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-slate-400">
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
          </div>
        </div>

        {/* RIGHT: Controls & Indicators */}
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div
            className="group relative hidden cursor-help items-center gap-2 rounded-2xl bg-white/5 px-3.5 py-2 text-xs text-slate-300 ring-1 ring-white/10 hover:ring-white/20 sm:flex"
            onMouseEnter={() => setConnTooltipOpen(true)}
            onMouseLeave={() => setConnTooltipOpen(false)}
          >
            <ConnectionDot connection={connection} />
            <span className="capitalize font-medium">{connection}</span>
            {latencyMs !== undefined && (
              <span className="font-mono text-slate-500">· {latencyMs}ms</span>
            )}

            {/* Improved Tooltip Positioning */}
            {connTooltipOpen && (
              <div className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
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
                <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-white/10 bg-slate-900" />
              </div>
            )}
          </div>

          {/* Real Role Indicator */}
          <div
            className={cn(
              "group relative flex cursor-help items-center gap-2.5 rounded-2xl bg-white/5 px-4 py-2 text-sm font-medium ring-1 ring-white/10 transition-all hover:bg-white/10 hover:ring-white/20",
              isOrganizer ? "text-amber-400" : "text-sky-400"
            )}
            onMouseEnter={() => setRoleTooltipOpen(true)}
            onMouseLeave={() => setRoleTooltipOpen(false)}
          >
            <div className="rounded-xl bg-white/10 p-1.5">
              <RoleIcon className="h-4 w-4" />
            </div>
            <span>{roleLabel}</span>

            {/* Improved Role Tooltip */}
            {roleTooltipOpen && (
              <div className="absolute left-1/2 top-full z-50 mt-2 w-80 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
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
                      Role sourced from auth session • No simulation active
                    </div>
                  </div>
                </div>
                <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-white/10 bg-slate-900" />
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
      </div>
    </header>
  );
}