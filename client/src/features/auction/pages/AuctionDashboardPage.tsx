import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  Coins,
  Gavel,
  ListOrdered,
  Pause,
  Play,
  TrendingUp,
  Users,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import {
  useAuth,
  useAuction,
  useAuctionPermissions,
  useLiveAuction,
  useAuctionRounds,
} from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { AuctionStatusBadge } from "@/features/auction/components/Badges";
import { AuctionLogs } from "@/features/auction/components/ActivityFeeds";
import { LiveStatistics } from "@/features/auction/components/LiveStatistics";
import { formatLakhs } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";

// ---------------------------------------------------------------------------
// Skeleton for initial auth hydration
// ---------------------------------------------------------------------------
function DashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl items-center justify-center py-32">
      <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth-gated empty state
// ---------------------------------------------------------------------------
function AuthRequiredState() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 py-32 text-center">
      <ShieldAlert className="h-12 w-12 text-rose-400" />
      <h2 className="text-lg font-bold text-white">Authentication Required</h2>
      <p className="max-w-sm text-sm text-slate-400">
        Please sign in to view the auction dashboard and manage live bidding.
      </p>
      <Link
        to="/login"
        className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110"
      >
        Sign In
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick stat card
// ---------------------------------------------------------------------------
function QuickCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-black text-white">
        {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-white/10" /> : value}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-600">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AuctionDashboardPage() {
  const { isAuthenticated, hasHydrated } = useAuth();

  // Resolve active auction IDs from the global live store.
  // In a multi-tenant app these are typically set during app bootstrap
  // or pulled from /tournaments/:tournamentId route params.
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);

  // Real backend hooks now require explicit IDs.
  const {
    auction,
    loading: auctionLoading,
    error: auctionError,
  } = useAuction(storeTournamentId || undefined);

  const {
    rounds,
    loading: roundsLoading,
  } = useAuctionRounds(storeAuctionId || undefined);

  // Live snapshot (engine-backed). Safe to call without IDs —
  // it falls back to the store's current snapshot if already bootstrapped.
  const live = useLiveAuction(storeAuctionId || undefined, storeTournamentId || undefined);
  const permissions = useAuctionPermissions();

  // Prefer static auction config when available; fall back to live snapshot.
  const activeAuction = auction ?? live.auction;
  const totalPlayers = live.players.length;

  // Guard: wait for auth store rehydration before rendering to avoid UI flash.
  if (!hasHydrated) return <DashboardSkeleton />;

  if (!isAuthenticated) return <AuthRequiredState />();

  // Guard: if no tournament/auction is active in the store, prompt user.
  if (!storeTournamentId || !storeAuctionId) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 py-32 text-center">
        <Gavel className="h-12 w-12 text-slate-500" />
        <h2 className="text-lg font-bold text-white">No Active Auction</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Select a tournament to load the auction dashboard, or create a new auction from the configuration page.
        </p>
        <Link
          to="/create"
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          Create Auction
        </Link>
      </div>
    );
  }

  const scheduledAt = activeAuction?.scheduledAt
    ? new Date(activeAuction.scheduledAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not scheduled";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-slate-900 to-slate-950 p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-2">
              <AuctionStatusBadge status={live.status} />
              <span className="text-xs text-slate-500">Auction Home</span>
              {live.connection && live.connection !== "connected" && (
                <span className="text-[10px] uppercase tracking-wider text-rose-400">
                  {live.connection}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {activeAuction?.name ?? "Auction Dashboard"}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              {activeAuction?.tournamentName
                ? `${activeAuction.tournamentName} · Organized by ${activeAuction.organizer}`
                : "Configure your tournament to get started"}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" /> Scheduled: {scheduledAt}
              </span>
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Increment tiers:{" "}
                {activeAuction?.rules?.bidIncrements?.length ?? 0}
              </span>
              <span className="flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5" /> Lot timer:{" "}
                {activeAuction?.rules?.lotTimerSeconds ?? 30}s
              </span>
            </div>
            {auctionError && (
              <p className="mt-3 text-xs font-medium text-rose-400">
                Error loading auction: {auctionError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Link
              to="/live"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110"
            >
              <Gavel className="h-4 w-4" /> Open Live Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="flex gap-2">
              {[
                {
                  action: live.actions.start,
                  icon: Play,
                  label: "Start",
                  allowed: permissions.canStart,
                },
                {
                  action: live.actions.pause,
                  icon: Pause,
                  label: "Pause",
                  allowed: permissions.canPause,
                },
                {
                  action: live.actions.resume,
                  icon: Play,
                  label: "Resume",
                  allowed: permissions.canResume,
                },
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => btn.action()}
                  disabled={!btn.allowed}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition",
                    "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10",
                    "disabled:cursor-not-allowed disabled:opacity-30"
                  )}
                >
                  <btn.icon className="h-3.5 w-3.5" /> {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <QuickCard
          icon={ListOrdered}
          label="Rounds Configured"
          value={`${rounds.length}`}
          sub="Marquee → Uncapped"
          loading={roundsLoading}
        />
        <QuickCard
          icon={Users}
          label="Total Players"
          value={`${totalPlayers}`}
          sub={`${live.playersSoldCount} sold so far`}
        />
        <QuickCard
          icon={Coins}
          label="Purse per Team"
          value={formatLakhs(activeAuction?.rules?.pursePerTeam ?? 0)}
          sub={`${live.franchises.length} franchises`}
        />
        <QuickCard
          icon={TrendingUp}
          label="Total Spent"
          value={formatLakhs(live.totalMoneySpent)}
          sub="Across all franchises"
        />
      </div>

      <LiveStatistics />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-white">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { to: "/create", label: "Configuration", icon: Coins },
              { to: "/rounds", label: "Round Management", icon: ListOrdered },
              { to: "/live", label: "Live Auction", icon: Gavel },
              { to: "/team", label: "Team Console", icon: Users },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center transition hover:border-amber-400/30 hover:bg-white/[0.05]"
              >
                <item.icon className="h-5 w-5 text-amber-300" />
                <span className="text-xs font-medium text-slate-300">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="h-80 lg:h-auto">
          <AuctionLogs limit={10} />
        </div>
      </div>
    </div>
  );
}