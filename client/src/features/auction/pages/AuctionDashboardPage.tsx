import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { toast } from "react-hot-toast";
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
  Settings2,
  History,
  BarChart3,
  Trophy,
  Radio,
  AlertTriangle,
  Zap,
  Clock,
  Activity,
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
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface DashboardRouteParams {
  tournamentId: string;
  auctionId: string;
}

interface UiCapabilities {
  showOrganizerPanel: boolean;
  showAuctionControls: boolean;
  showConfiguration: boolean;
  showRoundManagement: boolean;
  showTeamConsole: boolean;
  showResults: boolean;
  showStatistics: boolean;
  showActivityFeed: boolean;
  showLiveAuction: boolean;
  showHistory: boolean;
  showAnalytics: boolean;
}

interface QuickActionItem {
  to: string;
  label: string;
  icon: React.ElementType;
  accent: string;
  visible: boolean;
}

// ============================================================================
// UI CAPABILITY DERIVATION
// Derives high-level UI flags from server-authoritative permissions.
// The backend remains the sole source of truth; these are pure
// presentation-layer conveniences that never widen access.
// ============================================================================

function deriveUiCapabilities(
  permissions: ReturnType<typeof useAuctionPermissions>,
  user: ReturnType<typeof useAuth>["user"],
  auctionStatus?: string
): UiCapabilities {
  const isFranchise = user?.role === "FRANCHISE_OWNER";
  const isCompleted = auctionStatus === "completed";

  return {
    showOrganizerPanel:
      permissions.canManageAuction ||
      permissions.canAccessAuctionControls ||
      permissions.canStart ||
      permissions.canPause ||
      permissions.canResume ||
      permissions.canComplete,

    showAuctionControls:
      permissions.canStart ||
      permissions.canPause ||
      permissions.canResume ||
      permissions.canComplete,

    showConfiguration:
      permissions.canUpdateRules || permissions.canAccessRulesEditor,

    showRoundManagement:
      permissions.canManageRounds || permissions.canAccessRoundManagement,

    showTeamConsole: isFranchise,

    showResults: isCompleted,

    // Read-only visualizations — always visible to authenticated users
    showStatistics: true,
    showActivityFeed: true,
    showLiveAuction: true,
    showHistory: true,
    showAnalytics: true,
  };
}

// ============================================================================
// ROUTE BUILDER
// All navigation paths are constructed from the URL params so they
// never drift from the App.tsx route definitions.
// ============================================================================

function useAuctionRoutes(tournamentId: string, auctionId: string) {
  const base = `/tournaments/${tournamentId}/auction/${auctionId}`;
  return {
    dashboard: `${base}/dashboard`,
    configuration: `${base}/configuration`,
    rounds: `${base}/rounds`,
    live: `${base}/live`,
    team: `${base}/team`,
    history: `${base}/history`,
    analytics: `${base}/analytics`,
    results: `${base}/results`,
  };
}

// ============================================================================
// ANIMATION PRESETS
// ============================================================================

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Full-screen loader shown while auth store hydrates. */
function DashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl items-center justify-center py-32">
      <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
    </div>
  );
}

/** Shown when the user is not authenticated. */
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

/** Shown when the auction document could not be loaded. */
function AuctionErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div
      {...fadeUp}
      className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 py-32 text-center"
    >
      <AlertTriangle className="h-12 w-12 text-rose-400" />
      <h2 className="text-lg font-bold text-white">Auction Unavailable</h2>
      <p className="max-w-sm text-sm text-slate-400">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
      >
        <Zap className="h-4 w-4" />
        Retry
      </button>
    </motion.div>
  );
}

/** Connection status pill shown in the hero. */
function ConnectionPill({ connection }: { connection: string }) {
  const map: Record<string, { text: string; dot: string }> = {
    connected: { text: "Live", dot: "bg-emerald-400" },
    connecting: { text: "Connecting", dot: "bg-amber-400 animate-pulse" },
    reconnecting: { text: "Reconnecting", dot: "bg-amber-400 animate-pulse" },
    offline: { text: "Offline", dot: "bg-rose-500" },
  };
  const state = map[connection] ?? { text: connection, dot: "bg-slate-500" };

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ring-1 ring-white/10">
      <span className={cn("h-1.5 w-1.5 rounded-full", state.dot)} />
      {state.text}
    </span>
  );
}

/** Quick stat card with skeleton support. */
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
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 sm:mb-3 sm:h-10 sm:w-10">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <p className="truncate text-xl font-black text-white sm:text-2xl">
        {loading ? (
          <span className="inline-block h-7 w-16 animate-pulse rounded bg-white/10 sm:h-8" />
        ) : (
          value
        )}
      </p>
      <p className="truncate text-xs text-slate-500">{label}</p>
      {sub && <p className="mt-1 truncate text-[11px] text-slate-600">{sub}</p>}
    </div>
  );
}

/** Organizer-only auction lifecycle controls.
 *  Renders ONLY when the user has server-granted control permissions.
 *  Buttons are hidden (not disabled) when permissions are absent. */
function OrganizerControls({
  live,
  permissions,
  onRefresh,
}: {
  live: ReturnType<typeof useLiveAuction>;
  permissions: ReturnType<typeof useAuctionPermissions>;
  onRefresh?: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);

  const handleAction = async (key: string, action: () => unknown) => {
    // Guard against concurrent state transitions — auction lifecycle
    // events are mutually exclusive (you cannot pause while starting).
    if (pending) return;

    setPending(key);

    const verb =
      key === "start"
        ? "Starting"
        : key === "pause"
        ? "Pausing"
        : key === "resume"
        ? "Resuming"
        : "Completing";

    const toastId = toast.loading(`${verb} auction…`);

    try {
      const result = action();

      // Defensive: store actions may be sync (fire-and-forget) or async.
      // If it quacks like a Promise, we await it so the toast stays alive
      // until the server round-trips.
      if (result && typeof (result as Promise<void>).then === "function") {
        await (result as Promise<void>);
      }

      toast.success(
        `Auction ${verb.toLowerCase().replace("ing", "ed")} successfully`,
        { id: toastId }
      );

      // Reconcile the REST snapshot with the live store so the hero
      // banner, status badge, and permission gates all flip together.
      onRefresh?.();
    } catch (err: any) {
      // Surface the server message (e.g. "Auction already started")
      // or fall back to a generic operator-friendly prompt.
      toast.error(err?.message || `${verb} failed. Please try again.`, {
        id: toastId,
      });
    } finally {
      setPending(null);
    }
  };

  const controls: {
    key: string;
    action: () => unknown;
    icon: React.ElementType;
    label: string;
    allowed: boolean;
    tone: string;
  }[] = [
    {
      key: "start",
      action: live.actions.start,
      icon: Play,
      label: "Start",
      allowed: permissions.canStart,
      tone: "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 ring-emerald-500/30",
    },
    {
      key: "pause",
      action: live.actions.pause,
      icon: Pause,
      label: "Pause",
      allowed: permissions.canPause,
      tone: "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 ring-amber-500/30",
    },
    {
      key: "resume",
      action: live.actions.resume,
      icon: Play,
      label: "Resume",
      allowed: permissions.canResume,
      tone: "bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 ring-sky-500/30",
    },
   // {
    //  key: "complete",
    //  action: live.actions.complete,
    //  icon: Trophy,
    //  label: "Complete",
    //  allowed: permissions.canComplete,
    //  tone: "bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 ring-violet-500/30",
   // },
  ];

  const visible = controls.filter((c) => c.allowed);
  if (visible.length === 0) return null;

  return (
    <motion.div
      {...fadeUp}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <Zap className="h-3.5 w-3.5" /> Auction Controls
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map((btn) => (
          <button
            key={btn.key}
            onClick={() => handleAction(btn.key, btn.action)}
            disabled={pending !== null}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition ring-1",
              btn.tone,
              pending === btn.key && "opacity-80 cursor-wait",
              pending && pending !== btn.key && "opacity-50 cursor-not-allowed"
            )}
          >
            {pending === btn.key ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <btn.icon className="h-3.5 w-3.5" />
            )}
            {btn.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/** Permission-driven quick action tiles.
 *  Each tile is rendered ONLY when the corresponding capability exists.
 *  No disabled states — invisible means unauthorized. */
function QuickActions({
  routes,
  ui,
}: {
  routes: ReturnType<typeof useAuctionRoutes>;
  ui: UiCapabilities;
}) {
  const actions: QuickActionItem[] = [
    {
      to: routes.configuration,
      label: "Configuration",
      icon: Settings2,
      accent: "text-amber-300",
      visible: ui.showConfiguration,
    },
    {
      to: routes.rounds,
      label: "Round Management",
      icon: ListOrdered,
      accent: "text-sky-300",
      visible: ui.showRoundManagement,
    },
    {
      to: routes.live,
      label: "Live Auction",
      icon: Radio,
      accent: "text-rose-300",
      visible: ui.showLiveAuction,
    },
    {
      to: routes.team,
      label: "Team Console",
      icon: Users,
      accent: "text-emerald-300",
      visible: ui.showTeamConsole,
    },
    {
      to: routes.history,
      label: "Bid History",
      icon: History,
      accent: "text-violet-300",
      visible: ui.showHistory,
    },
    {
      to: routes.analytics,
      label: "Analytics",
      icon: BarChart3,
      accent: "text-indigo-300",
      visible: ui.showAnalytics,
    },
    {
      to: routes.results,
      label: "Results",
      icon: Trophy,
      accent: "text-teal-300",
      visible: ui.showResults,
    },
  ];

  const visible = actions.filter((a) => a.visible);
  if (visible.length === 0) return null;

  return (
    <motion.div {...fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="mb-4 text-sm font-semibold text-white">Quick Actions</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex flex-col items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center transition hover:border-amber-400/30 hover:bg-white/[0.05]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 transition group-hover:bg-white/10">
              <item.icon className={cn("h-5 w-5", item.accent)} />
            </div>
            <span className="text-xs font-medium text-slate-300">{item.label}</span>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

/** Hero banner with auction metadata and live CTA. */
function DashboardHero({
  live,
  activeAuction,
  routes,
  auctionError,
}: {
  live: ReturnType<typeof useLiveAuction>;
  activeAuction: ReturnType<typeof useAuction>["auction"];
  routes: ReturnType<typeof useAuctionRoutes>;
  auctionError: string | null;
}) {
  const scheduledAt = activeAuction?.scheduledAt
    ? new Date(activeAuction.scheduledAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not scheduled";
  const organizer = activeAuction?.tournamentId?.organizerId?.name ?? activeAuction?.organizer ?? "";

  return (
    <motion.div
      {...fadeUp}
      className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-slate-900 to-slate-950 p-4 sm:rounded-3xl sm:p-6 lg:p-8"
    >
      <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2.5 flex flex-wrap items-center gap-2 sm:mb-3">
            <AuctionStatusBadge status={live.status} />
            <span className="text-xs text-slate-500">Auction Home</span>
            <ConnectionPill connection={live.connection} />
          </div>

          <h1 className="break-words text-xl font-black leading-tight tracking-tight text-white sm:text-2xl lg:text-3xl">
            {activeAuction?.name ?? "Auction Dashboard"}
          </h1>

          <p className="mt-1.5 max-w-xl text-sm text-slate-400">
            {activeAuction?.tournamentName
              ? `${activeAuction.tournamentName} • Season ${activeAuction.season} · Organized by ${organizer}`
              : "Configure your tournament to get started"}
          </p>

          <div className="mt-4 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Scheduled: {scheduledAt}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              Increment tiers: {activeAuction?.rules?.bidIncrements?.length ?? 0}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Lot timer: {activeAuction?.rules?.lotTimerSeconds ?? 30}s
            </span>
          </div>

          {auctionError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
              <p className="text-xs font-medium text-rose-300">{auctionError}</p>
            </div>
          )}
        </div>

        <Link
          to={routes.live}
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110 sm:w-auto lg:w-auto"
        >
          <Gavel className="h-4 w-4" />
          Open Live Room
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AuctionDashboardPage() {
  const { isAuthenticated, hasHydrated, user } = useAuth();

  // ── Resolve IDs from URL (AuctionShell guarantees these exist) ──
  const { tournamentId, auctionId } = useParams<DashboardRouteParams>();
  const routes = useAuctionRoutes(tournamentId!, auctionId!);

  // ── Data fetching ──
  const {
    auction,
    loading: auctionLoading,
    error: auctionError,
    refresh: refreshAuction,
  } = useAuction(tournamentId);

  const {
    rounds,
    loading: roundsLoading,
  } = useAuctionRounds(auctionId);

  // Live snapshot (engine-backed). Pass explicit IDs so it works
  // regardless of whether the engine was already bootstrapped.
  const live = useLiveAuction({ auctionId, tournamentId });

  // Server-authoritative permissions
  const permissions = useAuctionPermissions(auctionId);

  // ── Derived state ──
  const activeAuction = auction ?? live.auction;
  const totalPlayers = live.players.length;

  // UI capability groups — pure presentation layer, never widens access
  const ui = deriveUiCapabilities(permissions, user, live.status);

  // ── Render guards ──
  if (!hasHydrated) return <DashboardSkeleton />;
  if (!isAuthenticated) return <AuthRequiredState />;

  // If the auction API returned an error and we have no live data either
  if (auctionError && !activeAuction) {
    return (
      <AuctionErrorState
        message={auctionError}
        onRetry={refreshAuction}
      />
    );
  }

  // ── Main layout ──
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="mx-auto max-w-7xl space-y-6"
    >
      {/* Hero */}
      <DashboardHero
        live={live}
        activeAuction={activeAuction}
        routes={routes}
        auctionError={auctionError}
      />

      {/* Organizer controls — only visible when server says so */}
      {ui.showOrganizerPanel && (
        <OrganizerControls live={live} permissions={permissions} onRefresh={refreshAuction}/>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
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
          sub={`${live.playersSoldCount} sold · ${live.playersUnsoldCount} unsold`}
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

      {/* Live statistics */}
      <LiveStatistics />

      {/* Quick actions + activity feed */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <QuickActions routes={routes} ui={ui} />

          {/* Current lot snapshot — only when a lot is active */}
          {live.currentPlayer && (
            <motion.div
              {...fadeUp}
              className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5"
            >
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300">
                <Activity className="h-3.5 w-3.5" /> Current Lot
              </p>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-white">{live.currentPlayer.name}</p>
                  <p className="truncate text-xs text-slate-400">{live.currentPlayer.role}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold text-amber-300">
                    {formatLakhs(live.currentBid.amount)}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {live.leadingFranchise?.shortName ?? "No bids yet"}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="h-80 lg:h-auto">
          <AuctionLogs limit={12} />
        </div>
      </div>
    </motion.div>
  );
}